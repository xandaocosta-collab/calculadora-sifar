import { CalculadoraPassivo } from './calculadora.js';

// Parâmetros fornecidos para o mock de teste com Matriz de Férias
const params = {
    dataAdmissao: '2014-08-05',
    vencimentoBaseMaio2020: 2043.88,
    categoria: 'Demais',
    historicoFerias: {
        2022: 4,
        2023: 12,
        2024: null,
        2025: 1
    },
    teveSuspensaoDisciplinar: false,
    teveLicencaSemVencimento: false,
    fezHorasExtras: false
};

// Instancia o motor
const calc = new CalculadoraPassivo(params);

// Processa o extrato e a dívida consolidada
const relatorio = calc.processarRelatorio();

console.log("\n==============================================");
console.log("       RELATÓRIO DO SERVIDOR SIFAR            ");
console.log("==============================================");
console.log(`-> Categoria:             ${params.categoria}`);
console.log(`-> Data Admissão:         05/08/2014`);
console.log(`-> Base Maio/2020:        R$ 2043.88`);
console.log("----------------------------------------------");
console.log(`  >>> TOTAL DEVIDO: R$ ${relatorio.totalAcumuladoEstimado}`);
console.log(`  >>> MESES DE DEFASAGEM: ${relatorio.quantiaDeMesesAtingidos}`);
console.log("----------------------------------------------");

console.log("\n=============== EXTRATO DETALHADO ==============");
console.table(relatorio.extrato.filter(r => r.competencia.includes('('))); // Filtra só meses espciais
console.log("================================================\n");
