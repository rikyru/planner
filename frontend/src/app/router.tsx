import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/pages/HomePage'
import { NewTripPage } from '@/pages/NewTripPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { TripPage } from '@/pages/TripPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/trips/new', element: <NewTripPage /> },
  { path: '/trips/:tripId', element: <TripPage /> },
  { path: '/trips/:tripId/day/:dayNumber', element: <TripPage /> },
  { path: '/trips/:tripId/photos', element: <TripPage view="photos" /> },
  { path: '*', element: <NotFoundPage /> },
])
