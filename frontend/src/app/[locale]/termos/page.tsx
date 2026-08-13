'use client'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

const LAST_UPDATED = '2026-08-13'

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Sobre a plataforma',
    body: [
      'O Lendly é uma plataforma comunitária que conecta vizinhos para o empréstimo gratuito e o aluguel remunerado de itens, e também organiza a formação de grupos privados de vizinhança. O Lendly funciona como intermediário tecnológico entre usuários — não é dono, fabricante, vendedor nem parte no empréstimo ou aluguel combinado entre dois usuários.',
    ],
  },
  {
    heading: '2. Quem pode usar',
    body: [
      'O uso do Lendly é destinado a maiores de 18 anos, com capacidade civil plena. Ao se cadastrar, você declara que as informações fornecidas (nome, e-mail, endereço, CPF quando aplicável, dados de empresa quando aplicável) são verdadeiras, completas e atualizadas.',
    ],
  },
  {
    heading: '3. Sua conta',
    body: [
      'Você é responsável por manter sua senha em sigilo e por toda atividade realizada a partir da sua conta. Avise-nos imediatamente se suspeitar de uso não autorizado. Cada CPF ou CNPJ pode estar vinculado a apenas uma conta.',
    ],
  },
  {
    heading: '4. Como funciona o empréstimo e o aluguel',
    body: [
      'Os itens anunciados na plataforma pertencem aos próprios usuários. Ao solicitar ou aceitar um empréstimo ou aluguel, dono e solicitante combinam diretamente entre si as condições de uso, devolução, estado do item e eventuais danos. O Lendly disponibiliza as ferramentas — chat, solicitação, avaliação, pagamento — mas não garante a qualidade, segurança, legalidade ou adequação dos itens anunciados, nem participa da negociação em si.',
    ],
  },
  {
    heading: '5. Pagamentos',
    body: [
      'Aluguéis remunerados são processados via Pix, através do Mercado Pago. Ao conectar sua conta Mercado Pago, você concorda com os termos de uso do Mercado Pago para esse processamento. O Lendly retém uma taxa de plataforma sobre cada transação paga, informada no momento do pagamento, e, quando o item tem valor de reposição declarado, também uma taxa de garantia (ver seção 8). O Lendly não armazena dados de cartão nem processa pagamentos diretamente — isso é feito integralmente pelo Mercado Pago.',
    ],
  },
  {
    heading: '6. Verificação de identidade',
    body: [
      'Para aumentar a segurança da comunidade, o Lendly pode solicitar o envio de documento de identidade para liberar o empréstimo ou aluguel de determinados itens. O documento é usado exclusivamente para fins de verificação e tratado conforme nossa Política de Privacidade.',
    ],
  },
  {
    heading: '7. Responsabilidade sobre os itens',
    body: [
      'O Lendly não é seguradora e não garante reembolso, substituição ou reparo em caso de dano, perda, atraso na devolução ou uso inadequado de um item. Essas situações são de responsabilidade combinada entre quem empresta e quem toma emprestado — recomendamos registrar o estado do item e as condições combinadas antes da entrega. Para itens com valor de reposição declarado e taxa de garantia cobrada, existe adicionalmente o programa de garantia descrito na seção 8 — ele não altera o disposto aqui além do que está expressamente descrito naquela seção.',
    ],
  },
  {
    heading: '8. Garantia do item',
    body: [
      'O dono de um item em aluguel pago pode declarar um valor de reposição para ele. Quando esse valor é declarado, cada aluguel pago desse item inclui uma taxa de garantia adicional, cobrada do solicitante, que alimenta um fundo coletivo mantido pelo Lendly.',
      'Depois que o aluguel é finalizado, o dono pode registrar um pedido de ressarcimento em até 7 dias, descrevendo o ocorrido e o valor pedido — limitado ao valor de reposição declarado do item. A equipe do Lendly analisa o pedido e decide, a seu critério, aprová-lo integralmente, parcialmente ou recusá-lo, considerando as evidências apresentadas.',
      'Este é um programa de assistência mantido pela própria comunidade de usuários, não um seguro: o Lendly não é uma seguradora licenciada, a aprovação de um pedido não é automática nem garantida, e não há prazo específico ou obrigação de pagamento integral. O saldo do fundo não limita a análise de um pedido, mas também não constitui garantia de que haverá recursos disponíveis.',
    ],
  },
  {
    heading: '9. Grupos',
    body: [
      'Grupos são espaços privados criados por usuários, com entrada por convite ou aprovação. Quem cria um grupo é responsável por moderá-lo, e o Lendly pode remover grupos ou membros que violem estes termos, mesmo sem participação direta na administração do grupo.',
    ],
  },
  {
    heading: '10. Conduta proibida',
    body: [
      'É proibido: anunciar itens ilegais, perigosos ou que violem direitos de terceiros; usar a plataforma para fins fraudulentos; assediar, discriminar ou ofender outros usuários; enviar spam ou conteúdo comercial não relacionado; tentar contornar os mecanismos de segurança, pagamento ou verificação da plataforma.',
    ],
  },
  {
    heading: '11. Avaliações e denúncias',
    body: [
      'Após cada empréstimo ou aluguel, os usuários podem avaliar um ao outro. Avaliações devem refletir experiências reais. Itens, usuários e grupos podem ser denunciados; denúncias são analisadas pela nossa equipe de moderação, que pode advertir, suspender ou excluir contas, itens ou grupos.',
    ],
  },
  {
    heading: '12. Suspensão e encerramento',
    body: [
      'Podemos suspender ou encerrar contas que violem estes termos, mediante aviso quando possível. Você pode encerrar sua conta a qualquer momento nas configurações do seu perfil.',
    ],
  },
  {
    heading: '13. Propriedade intelectual',
    body: [
      'A marca Lendly, o layout e o código da plataforma pertencem ao Lendly. O conteúdo que você publica (fotos, descrições, avaliações) continua seu, mas você concede ao Lendly uma licença para exibi-lo na plataforma enquanto sua conta ou o conteúdo estiverem ativos.',
    ],
  },
  {
    heading: '14. Limitação de responsabilidade',
    body: [
      'Na máxima extensão permitida pela lei, o Lendly não se responsabiliza por danos indiretos, lucros cessantes ou prejuízos decorrentes de empréstimos ou aluguéis combinados entre usuários, indisponibilidade temporária da plataforma, ou ações de terceiros — incluindo o Mercado Pago.',
    ],
  },
  {
    heading: '15. Alterações destes termos',
    body: [
      'Podemos atualizar estes termos para refletir mudanças na plataforma ou na legislação. Mudanças relevantes serão comunicadas, e o uso continuado da plataforma após a atualização representa sua concordância com a nova versão.',
    ],
  },
  {
    heading: '16. Lei aplicável',
    body: [
      'Estes termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do usuário consumidor, conforme o Código de Defesa do Consumidor, para dirimir eventuais controvérsias.',
    ],
  },
  {
    heading: '17. Contato',
    body: ['Dúvidas sobre estes termos podem ser enviadas para contato@lendly.app.'],
  },
]

export default function TermsPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('Legal')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-ink-muted hover:text-ink text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('back')}
      </button>

      <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-1">
        {t('Terms.title')}
      </h1>
      <p className="text-xs text-ink-subtle mb-8">{t('lastUpdated', { date: LAST_UPDATED })}</p>

      {locale !== 'pt' && (
        <p className="text-sm text-ink-muted bg-surface-2 border border-border rounded-control p-3 mb-8">
          {t('ptOnlyNote')}
        </p>
      )}

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-ink mb-2">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm text-ink-muted leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
