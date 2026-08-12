'use client'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

const LAST_UPDATED = '2026-08-12'

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Quem somos',
    body: [
      'Esta política descreve como o Lendly coleta, usa, compartilha e protege os dados pessoais de quem usa a plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).',
    ],
  },
  {
    heading: '2. Quais dados coletamos',
    body: [
      'Dados de identificação: nome, e-mail, telefone, CPF (para verificação de identidade) e, para contas empresariais, CNPJ e razão social.',
      'Endereço e localização: CEP, rua, número, complemento, bairro, cidade, estado e coordenadas geográficas — usados para mostrar itens e grupos próximos a você. Seu endereço exato nunca é exibido publicamente para outros usuários.',
      'Documento de identidade: quando você opta pela verificação de identidade, coletamos a imagem do documento enviado.',
      'Dados de pagamento: ao conectar sua conta Mercado Pago para receber pagamentos, armazenamos as credenciais necessárias para processar as transações em seu nome, de forma criptografada. Não temos acesso a dados de cartão de crédito.',
      'Conteúdo que você gera: itens anunciados, mensagens de chat, avaliações, participação em grupos, avisos de mural.',
      'Dados técnicos: endereço IP, tipo de dispositivo e navegador, cookies de sessão e tokens de autenticação.',
    ],
  },
  {
    heading: '3. Por que coletamos esses dados',
    body: [
      'Tratamos seus dados com base em: execução do contrato de uso da plataforma (cadastro, empréstimos, pagamentos); seu consentimento (verificação de identidade, notificações); cumprimento de obrigação legal (retenção fiscal de dados de pagamento); e legítimo interesse (segurança, prevenção a fraude, melhoria da plataforma).',
    ],
  },
  {
    heading: '4. Com quem compartilhamos',
    body: [
      'Compartilhamos dados apenas quando necessário: com o Mercado Pago, para processar pagamentos; com provedores de e-mail, para enviar notificações e confirmações; com provedores de geolocalização e CEP (ViaCEP, BrasilAPI, OpenStreetMap), para converter endereços em coordenadas. Não vendemos seus dados a terceiros.',
    ],
  },
  {
    heading: '5. Segurança',
    body: [
      'Senhas são armazenadas com hash criptográfico, nunca em texto puro. Você pode ativar autenticação em duas etapas (TOTP) para reforçar a segurança da sua conta. Tokens sensíveis, como as credenciais do Mercado Pago, são criptografados em repouso.',
    ],
  },
  {
    heading: '6. Por quanto tempo guardamos seus dados',
    body: [
      'Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir sua conta, seus dados pessoais são anonimizados, exceto quando a lei exigir retenção por período determinado — por exemplo, registros fiscais de transações de pagamento.',
    ],
  },
  {
    heading: '7. Seus direitos',
    body: [
      'Conforme a LGPD, você tem direito a confirmar a existência de tratamento, acessar, corrigir, solicitar a portabilidade ou a exclusão dos seus dados, e revogar consentimentos dados anteriormente. Você pode exportar uma cópia dos seus dados e excluir sua conta a qualquer momento diretamente nas configurações do seu perfil, sem precisar entrar em contato com o suporte.',
    ],
  },
  {
    heading: '8. Cookies e tokens',
    body: [
      'Usamos cookies e tokens de sessão estritamente necessários para manter você conectado e para lembrar suas preferências, como idioma e tema. Não usamos cookies de rastreamento publicitário de terceiros.',
    ],
  },
  {
    heading: '9. Menores de idade',
    body: [
      'O Lendly não é destinado a menores de 18 anos, e não coletamos intencionalmente dados de menores.',
    ],
  },
  {
    heading: '10. Alterações desta política',
    body: [
      'Podemos atualizar esta política para refletir mudanças na plataforma ou na legislação. A data da última atualização está sempre indicada no topo desta página.',
    ],
  },
  {
    heading: '11. Contato',
    body: [
      'Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados, entre em contato pelo e-mail contato@lendly.app.',
    ],
  },
]

export default function PrivacyPage() {
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
        {t('Privacy.title')}
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
              <p key={i} className="text-sm text-ink-muted leading-relaxed mb-2 last:mb-0">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
