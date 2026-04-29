/**
 * Motor matemático para cálculo de passivo trabalhista (LC 173) - Araucária/PR
 * v2.0 — Correções auditadas em 15/04/2025:
 * [FIX-A] Efeito Cascata: percentuais agora compostos por multiplicação, não soma simples.
 * [FIX-B] Proporcionalidade: eliminadas frações de mês; progressão entra no 1º dia do mês seguinte.
 */

class CalculadoraPassivo {
    /**
     * @param {Object} params
     * @param {string|Date} params.dataAdmissao - Ex: '2015-02-10'
     * @param {number} params.vencimentoBaseMaio2020 - O Vencimento Base da época (maio/2020)
     * @param {'Saúde/Segurança' | 'Demais'} params.categoria - Impacta na trava do teto
     * @param {Object} params.historicoFerias - Objeto com mapa de anos { "2022": 4, "2023": 11 }
     * @param {boolean} params.teveSuspensaoDisciplinar - Flag de suspensão
     * @param {boolean} params.teveLicencaSemVencimento - Flag de licença
     * @param {boolean} params.fezHorasExtras - Flag para reflexo de HE
     */
    constructor(params) {
        // Inicializa forçando a meia-noite local para evitar variações de fuso mudando o dia
        this.dataAdmissao = new Date(params.dataAdmissao + 'T00:00:00');

        this.vencimentoBaseMaio2020 = Number(params.vencimentoBaseMaio2020);
        this.categoria = params.categoria;

        // Recebimento da matriz anual paramétrica de férias
        this.historicoFerias = params.historicoFerias || {};

        this.teveSuspensaoDisciplinar = Boolean(params.teveSuspensaoDisciplinar);
        this.teveLicencaSemVencimento = Boolean(params.teveLicencaSemVencimento);
        this.fezHorasExtras = Boolean(params.fezHorasExtras);

        // Constantes da Lei Complementar 173 (O Congelamento)
        this.INICIO_CONGELAMENTO = new Date('2020-05-28T00:00:00');
        this.FIM_CONGELAMENTO = new Date('2022-01-01T00:00:00');
        this.DIAS_CONGELADOS = 583;
    }

    // ─────────────────────────────────────────────────────────────────
    // Base salarial corrigida pelos reajustes municipais
    // ─────────────────────────────────────────────────────────────────
    obterBaseAtualizada(ano, mes) {
        let valor = this.vencimentoBaseMaio2020;

        if (ano > 2022 || (ano === 2022 && mes >= 6)) valor *= 1.16;
        if (ano > 2023 || (ano === 2023 && mes >= 6)) valor *= 1.0383;
        if (ano > 2024 || (ano === 2024 && mes >= 6)) valor *= 1.0323;
        if (ano > 2025 || (ano === 2025 && mes >= 6)) valor *= 1.06;
        if (ano > 2025 || (ano === 2025 && mes >= 9)) valor *= 1.015;

        return valor;
    }

    // ─────────────────────────────────────────────────────────────────
    // Data real de aquisição de um nível, considerando o congelamento
    // ─────────────────────────────────────────────────────────────────
    getDataAquisicao(anosRequisito, isIdeal) {
        let dataAquisicao = new Date(this.dataAdmissao);
        dataAquisicao.setFullYear(dataAquisicao.getFullYear() + anosRequisito);

        if (isIdeal || dataAquisicao < this.INICIO_CONGELAMENTO) {
            return dataAquisicao;
        }

        let admissao = this.dataAdmissao;

        if (admissao < this.INICIO_CONGELAMENTO) {
            let dataReal = new Date(dataAquisicao);
            dataReal.setDate(dataReal.getDate() + this.DIAS_CONGELADOS);
            return dataReal;
        }

        if (admissao >= this.INICIO_CONGELAMENTO && admissao < this.FIM_CONGELAMENTO) {
            let dataReal = new Date(this.FIM_CONGELAMENTO);
            dataReal.setFullYear(dataReal.getFullYear() + anosRequisito);
            return dataReal;
        }

        return dataAquisicao;
    }

    // ─────────────────────────────────────────────────────────────────
    // [FIX-A] Percentual composto no dia-alvo
    // ─────────────────────────────────────────────────────────────────
    getPercentualAtivoNoDia(targetDate, isIdeal) {
        let fator = 1.0;

        // Triênios: +10% composto a cada 3 anos (máx. 15 triênios)
        for (let i = 1; i <= 15; i++) {
            let acq = this.getDataAquisicao(i * 3, isIdeal);
            if (targetDate >= acq) {
                fator *= 1.10;
            } else {
                break;
            }
        }

        // Quinquênios: +5% composto a cada 5 anos (máx. 9 quinquênios)
        for (let i = 1; i <= 9; i++) {
            let acq = this.getDataAquisicao(i * 5, isIdeal);
            if (targetDate >= acq) {
                fator *= 1.05;
            } else {
                break;
            }
        }

        // Retorna somente o adicional (sem incluir a base 1.0)
        return fator - 1.0;
    }

    // ─────────────────────────────────────────────────────────────────
    // [FIX-B] Percentual do mês sem frações diárias
    // ─────────────────────────────────────────────────────────────────
    getPercentualMedioMes(ano, mes, isIdeal) {
        // Meio-dia do 1º dia do mês para evitar ambiguidades de meia-noite
        let primeiroDiaMes = new Date(ano, mes - 1, 1, 12, 0, 0);
        return this.getPercentualAtivoNoDia(primeiroDiaMes, isIdeal);
    }

    // ─────────────────────────────────────────────────────────────────
    // Relatório mensal completo
    // ─────────────────────────────────────────────────────────────────
    processarRelatorio() {
        // 1. Início Obrigatório do Laço
        let anoControle = 2020;
        let mesControle = 5;

        // 2. Lógica de Início do Extrato (Triênio ou Quinquênio)
        let anoExibicao = 2022;
        let mesExibicao = 1;
        let dataPrimeiroDireito = null;
        let limiteInferior = new Date(2020, 4, 1); // Maio de 2020
        let limiteSuperior = new Date(2021, 11, 31, 23, 59, 59); // Dezembro de 2021

        for (let anos = 1; anos <= 35; anos++) {
            if (anos % 3 === 0 || anos % 5 === 0) {
                let dataDireito = new Date(this.dataAdmissao);
                dataDireito.setFullYear(dataDireito.getFullYear() + anos);
                
                if (dataDireito >= limiteInferior && dataDireito <= limiteSuperior) {
                    if (!dataPrimeiroDireito || dataDireito < dataPrimeiroDireito) {
                        dataPrimeiroDireito = new Date(dataDireito);
                    }
                }
            }
        }

        if (dataPrimeiroDireito) {
            anoExibicao = dataPrimeiroDireito.getFullYear();
            mesExibicao = dataPrimeiroDireito.getMonth() + 1;
        }

        // 4. Travas Finais por Categoria
        let anoFim, mesFim;
        if (this.categoria === 'Saúde/Segurança') {
            anoFim = 2021;
            mesFim = 12;
        } else {
            anoFim = 2024;
            mesFim = 4;
        }

        let extratoMensal = [];
        let totalAcumuladoGeral = 0;

        while (anoControle < anoFim || (anoControle === anoFim && mesControle <= mesFim)) {

            // Correção de Homologação: usar a base estritamente pura para evitar juros sobre juros
            let salarioBaseAqueleMes = this.vencimentoBaseMaio2020;

            let fatorIdeal = this.getPercentualMedioMes(anoControle, mesControle, true);
            let fatorReal = this.getPercentualMedioMes(anoControle, mesControle, false);

            let vencimentoIdeal = salarioBaseAqueleMes * fatorIdeal;
            let vencimentoReal = salarioBaseAqueleMes * fatorReal;

            let diferencaMes = vencimentoIdeal - vencimentoReal;

            // O Município só é devedor se a diferença for positiva
            let valorDevidoPassivo = Math.max(0, diferencaMes);

            // Reflexo de Férias (1/3) mapeado pelo histórico da matriz de anos
            let valorAcrescimoFerias = 0;
            let mesGozoDoAno = this.historicoFerias[anoControle];

            if (mesGozoDoAno && mesGozoDoAno === mesControle && valorDevidoPassivo > 0) {
                valorAcrescimoFerias = valorDevidoPassivo / 3;
            }

            // Reflexo 13º Salário
            let valorAcrescimo13 = 0;
            if (mesControle === 12 && valorDevidoPassivo > 0) {
                valorAcrescimo13 = valorDevidoPassivo;
            }

            let totalPagoAqui = valorDevidoPassivo + valorAcrescimoFerias + valorAcrescimo13;

            // Montagem do descritor de competência
            let msgsAdicionais = [];
            if (valorAcrescimoFerias > 0) msgsAdicionais.push('+ 1/3 Férias');
            if (valorAcrescimo13 > 0) msgsAdicionais.push('+ 13º');

            let compDesc = msgsAdicionais.length > 0
                ? `${String(mesControle).padStart(2, '0')}/${anoControle} (${msgsAdicionais.join(', ')})`
                : `${String(mesControle).padStart(2, '0')}/${anoControle}`;

            // 3. Registo Visual no Extrato
            let deveExibir = (anoControle > anoExibicao) || (anoControle === anoExibicao && mesControle >= mesExibicao);

            if (deveExibir) {
                extratoMensal.push({
                    competencia: compDesc,
                    baseDaEpoca: Number(salarioBaseAqueleMes.toFixed(2)),
                    percentualAdqIdeal: `${(fatorIdeal * 100).toFixed(2)} %`,
                    percentualAdqReal: `${(fatorReal * 100).toFixed(2)} %`,
                    deviaTerRecebido: Number(vencimentoIdeal.toFixed(2)),
                    recebeuDeFato: Number(vencimentoReal.toFixed(2)),
                    diferencaCreditada: Number(totalPagoAqui.toFixed(2))
                });
                totalAcumuladoGeral += totalPagoAqui;
            }

            mesControle++;
            if (mesControle > 12) {
                mesControle = 1;
                anoControle += 1;
            }
        }

        let avisosOperacao = [];
        if (this.teveLicencaSemVencimento || this.teveSuspensaoDisciplinar) {
            avisosOperacao.push(
                "ATENÇÃO: Flag de suspensão/licença ativada. O motor puro carece de um conjunto de datas precisas para descontar de maneira fidedigna o tempo perdido. O cálculo prosseguiu sem estas deduções."
            );
        }

        return {
            totalAcumuladoEstimado: Number(totalAcumuladoGeral.toFixed(2)),
            quantiaDeMesesAtingidos: extratoMensal.length,
            extrato: extratoMensal,
            avisos: avisosOperacao
        };
    }
}

// Exporta para NodeJS ou vincula no Window se incluído por script tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalculadoraPassivo };
} else if (typeof window !== 'undefined') {
    window.CalculadoraPassivo = CalculadoraPassivo;
}