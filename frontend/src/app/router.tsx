import { createBrowserRouter } from 'react-router'

import { NotFoundPage } from '@/pages/NotFoundPage'

// Ogni pagina è un chunk separato: chi apre un link condiviso scarica solo il diario e la mappa,
// non l'editor.
export const router = createBrowserRouter([
  { path: '/', lazy: () => import('@/pages/HomePage').then((m) => ({ Component: m.HomePage })) },
  { path: '/trips/new', lazy: () => import('@/pages/NewTripPage').then((m) => ({ Component: m.NewTripPage })) },
  { path: '/trips/:tripId', lazy: () => import('@/pages/TripPage').then((m) => ({ Component: m.TripPage })) },
  {
    path: '/trips/:tripId/day/:dayNumber',
    lazy: () => import('@/pages/TripPage').then((m) => ({ Component: m.TripPage })),
  },
  {
    path: '/trips/:tripId/photos',
    lazy: () => import('@/pages/TripPage').then((m) => ({ Component: () => <m.TripPage view="photos" /> })),
  },
  { path: '/share/:token', lazy: () => import('@/pages/SharePage').then((m) => ({ Component: m.SharePage })) },
  { path: '*', element: <NotFoundPage /> },
])
