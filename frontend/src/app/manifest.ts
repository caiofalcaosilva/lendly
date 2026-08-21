import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lendly — Empréstimo e aluguel entre vizinhos',
    short_name: 'Lendly',
    description:
      'Lendly conecta vizinhos e negócios locais pra emprestar e alugar objetos com segurança.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#1f7a46',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
