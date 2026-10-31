// Preguntas frecuentes de Expenses (solo del producto: qué hace, para quién es, qué ofrece y qué ventajas tiene).
// Las usan el login y la página de inicio (también como datos estructurados para Google).
export interface Faq {
    question: string;
    answer: string;
}

export const FAQS: Faq[] = [
    {
        question: '¿Qué es Expenses y qué hace?',
        answer:
            'Expenses es una plataforma para administrar condominios y edificios en propiedad horizontal en Paraguay. Reúne en un solo lugar el cálculo y cobro de expensas, los gastos y proveedores, la morosidad, la contabilidad y la comunicación con propietarios y residentes, todo en Guaraníes.'
    },
    {
        question: '¿Quiénes pueden usar Expenses?',
        answer:
            'Administradores de condominios, empresas administradoras de edificios y consorcios, que gestionan uno o varios edificios. También la usan los encargados de cada edificio, y los propietarios y residentes, que consultan su información desde la app para Android.'
    },
    {
        question: '¿Qué servicios y funciones ofrece?',
        answer:
            'Expensas ordinarias y extraordinarias y fondo de reserva; cobros, recibos y facturas; control de morosidad con recargos por mora automáticos; gastos, proveedores y cuentas por pagar; ingresos y presupuesto; conciliación bancaria; libro de compras con IVA; libro diario, libro mayor, balance y cierre de ejercicio; informes para la asamblea; comunicados, reclamos, reservas de espacios comunes y votaciones; e importación de datos desde Excel.'
    },
    {
        question: '¿Qué ventajas tiene para el administrador?',
        answer:
            'Centraliza la información financiera de cada edificio, automatiza el cálculo de expensas y la mora, reduce el trabajo manual en planillas, deja la contabilidad ordenada para el contador y mantiene un historial de cada operación. Cada usuario ve solo lo que le corresponde según su rol.'
    },
    {
        question: '¿Los propietarios pueden ver sus estados de cuenta?',
        answer:
            'Sí. Desde la app para Android, cada propietario consulta sus expensas, pagos, recibos y deuda, informa sus pagos con comprobante, recibe avisos, reserva espacios comunes y presenta reclamos.'
    },
    {
        question: '¿Hay una app para el celular?',
        answer:
            'Sí, hay una app para Android que se descarga desde esta misma página, con avisos y notificaciones para propietarios, residentes y encargados.'
    },
    {
        question: '¿Puedo administrar más de un edificio?',
        answer:
            'Sí. Una misma cuenta puede administrar varios edificios, cada uno con sus propias unidades, finanzas y usuarios, sin mezclar la información entre ellos.'
    },
    {
        question: '¿Mis datos están protegidos?',
        answer:
            'Sí. Cada operación queda registrada con su historial y auditoría, los permisos se asignan por rol y el acceso es por conexión segura. Lo contable que ya fue asentado no se modifica: los errores se corrigen con un contraasiento.'
    },
    {
        question: '¿Puedo probar Expenses antes de contratar?',
        answer:
            'Sí. Con «Explorar demostración gratuita» entras a un edificio ficticio, sin registrarte y sin tocar datos reales: revisas el panel, abres el estado de cuenta de una unidad, registras un gasto simulado, consultas informes y ves el libro diario.'
    },
    {
        question: '¿Cómo puedo pedir una cotización?',
        answer:
            'Escribinos por WhatsApp con el botón «Pedí tu cotización» de esta página y te contamos cómo implementar Expenses en tu edificio o en tu cartera de condominios.'
    }
];

// Versión en portugués de las mismas preguntas (página /pt/).
export const FAQS_PT: Faq[] = [
    {
        question: 'O que é a Expenses e o que ela faz?',
        answer:
            'A Expenses é uma plataforma para administrar condomínios e edifícios em propriedade horizontal no Paraguai. Reúne em um só lugar o cálculo e a cobrança da taxa condominial, as despesas e fornecedores, a inadimplência, a contabilidade e a comunicação com proprietários e moradores, tudo em guaranis.'
    },
    {
        question: 'Quem pode usar a Expenses?',
        answer:
            'Síndicos e administradores de condomínios, empresas administradoras de edifícios e consórcios que gerenciam um ou vários edifícios. Também a usam os encarregados de cada edifício, e os proprietários e moradores, que consultam suas informações pelo app para Android.'
    },
    {
        question: 'Quais serviços e funções ela oferece?',
        answer:
            'Taxas condominiais ordinárias e extraordinárias e fundo de reserva; cobranças, recibos e faturas; controle de inadimplência com multa e juros por atraso automáticos; despesas, fornecedores e contas a pagar; receitas e orçamento; conciliação bancária; livro de compras com IVA; livro diário, livro razão, balanço e encerramento do exercício; relatórios para a assembleia; comunicados, reclamações, reservas de áreas comuns e votações; e importação de dados a partir do Excel.'
    },
    {
        question: 'Quais são as vantagens para o administrador?',
        answer:
            'Centraliza a informação financeira de cada edifício, automatiza o cálculo da taxa condominial e da multa por atraso, reduz o trabalho manual em planilhas, deixa a contabilidade organizada para o contador e mantém o histórico de cada operação. Cada usuário vê apenas o que corresponde ao seu perfil.'
    },
    {
        question: 'Os proprietários podem ver seus extratos?',
        answer:
            'Sim. Pelo app para Android, cada proprietário consulta suas taxas, pagamentos, recibos e dívida, informa pagamentos com comprovante, recebe avisos, reserva áreas comuns e registra reclamações.'
    },
    {
        question: 'Existe um app para o celular?',
        answer:
            'Sim, há um app para Android que pode ser baixado nesta mesma página, com avisos e notificações para proprietários, moradores e encarregados.'
    },
    {
        question: 'Posso administrar mais de um edifício?',
        answer:
            'Sim. Uma mesma conta pode administrar vários edifícios, cada um com suas próprias unidades, finanças e usuários, sem misturar a informação entre eles.'
    },
    {
        question: 'Meus dados estão protegidos?',
        answer:
            'Sim. Cada operação fica registrada com histórico e auditoria, as permissões são atribuídas por perfil e o acesso é por conexão segura. O que já foi lançado na contabilidade não é alterado: os erros se corrigem com um lançamento de estorno.'
    },
    {
        question: 'Posso testar a Expenses antes de contratar?',
        answer:
            'Sim. Com «Explorar demonstração gratuita» você entra em um edifício fictício, sem cadastro e sem tocar em dados reais: vê o painel, abre o extrato de uma unidade, registra uma despesa simulada, consulta relatórios e vê o livro diário.'
    },
    {
        question: 'Como posso pedir um orçamento?',
        answer:
            'Escreva para nós pelo WhatsApp com o botão «Peça seu orçamento» desta página e contamos como implementar a Expenses no seu edifício ou na sua carteira de condomínios.'
    }
];

// English version of the same questions (page /en/).
export const FAQS_EN: Faq[] = [
    {
        question: 'What is Expenses and what does it do?',
        answer:
            'Expenses is a platform for managing condominiums and buildings under horizontal property regimes in Paraguay. It brings together in one place the calculation and collection of maintenance fees, expenses and suppliers, arrears, accounting and communication with owners and residents, all in Guaraníes.'
    },
    {
        question: 'Who can use Expenses?',
        answer:
            "Condominium administrators, building management companies and consortiums that manage one or several buildings. It is also used by each building's on-site manager, and by owners and residents, who check their information from the Android app."
    },
    {
        question: 'What services and features does it offer?',
        answer:
            "Ordinary and extraordinary maintenance fees and reserve fund; collections, receipts and invoices; arrears control with automatic late charges; expenses, suppliers and accounts payable; income and budget; bank reconciliation; purchases ledger with VAT; general journal, general ledger, balance sheet and year-end closing; reports for the owners' meeting; announcements, complaints, common-area bookings and votes; and data import from Excel."
    },
    {
        question: 'What are the advantages for the administrator?',
        answer:
            'It centralizes the financial information of each building, automates the calculation of fees and late charges, cuts manual work in spreadsheets, leaves the accounting organized for the accountant and keeps a history of every operation. Each user sees only what corresponds to their role.'
    },
    {
        question: 'Can owners see their account statements?',
        answer:
            'Yes. From the Android app, each owner checks their fees, payments, receipts and balance due, reports payments with proof of payment, receives notices, books common areas and submits complaints.'
    },
    {
        question: 'Is there a mobile app?',
        answer:
            'Yes, there is an Android app that you can download from this same page, with alerts and notifications for owners, residents and on-site managers.'
    },
    {
        question: 'Can I manage more than one building?',
        answer:
            'Yes. A single account can manage several buildings, each with its own units, finances and users, without mixing information between them.'
    },
    {
        question: 'Is my data protected?',
        answer:
            'Yes. Every operation is recorded with its history and audit trail, permissions are assigned by role and access is over a secure connection. Accounting entries that have already been posted are not edited: errors are corrected with a reversing entry.'
    },
    {
        question: 'Can I try Expenses before signing up?',
        answer:
            "Yes. With \"Explore the free demo\" you enter a fictitious building, without registering and without touching real data: you review the dashboard, open a unit's account statement, record a simulated expense, check reports and see the general journal."
    },
    {
        question: 'How can I request a quote?',
        answer:
            'Message us on WhatsApp with the "Request your quote" button on this page and we will tell you how to implement Expenses in your building or in your portfolio of condominiums.'
    }
];

export type FaqLang = 'es' | 'pt' | 'en';

export function faqsFor(lang: FaqLang): Faq[] {
    return lang === 'pt' ? FAQS_PT : lang === 'en' ? FAQS_EN : FAQS;
}
