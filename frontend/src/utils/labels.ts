import {
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  CircleQuestionMark,
  Landmark,
  MapPin,
  Moon,
  SquareParking,
  Plane,
  Ship,
  ShoppingBag,
  BedDouble,
  TrainFront,
  TramFront,
  Trees,
  UtensilsCrossed,
  TicketsPlane,
  type LucideIcon,
} from 'lucide-react'

import type { StopCategory, TimePrecision, TransportMode } from '@/types'

export const CATEGORIES: Record<StopCategory, { label: string; icon: LucideIcon; color: string }> = {
  attraction: { label: 'Attrazione', icon: Landmark, color: '#2f6577' },
  food: { label: 'Cibo', icon: UtensilsCrossed, color: '#c8643b' },
  hotel: { label: 'Alloggio', icon: BedDouble, color: '#6b5b95' },
  transport: { label: 'Trasporto', icon: TicketsPlane, color: '#4a6fa5' },
  parking: { label: 'Parcheggio', icon: SquareParking, color: '#5c6b73' },
  nature: { label: 'Natura', icon: Trees, color: '#4f7f4f' },
  shopping: { label: 'Shopping', icon: ShoppingBag, color: '#b5577a' },
  nightlife: { label: 'Vita notturna', icon: Moon, color: '#3d3b6e' },
  custom: { label: 'Altro', icon: MapPin, color: '#7a6a58' },
}

export const CATEGORY_ORDER = Object.keys(CATEGORIES) as StopCategory[]

export const TRANSPORT: Record<TransportMode, { label: string; icon: LucideIcon; color: string }> = {
  walking: { label: 'A piedi', icon: Footprints, color: '#4f7f4f' },
  subway: { label: 'Metro', icon: TramFront, color: '#2f6577' },
  train: { label: 'Treno', icon: TrainFront, color: '#4a6fa5' },
  bus: { label: 'Bus', icon: Bus, color: '#b07d2b' },
  car: { label: 'Auto', icon: Car, color: '#5c6b73' },
  taxi: { label: 'Taxi', icon: CarTaxiFront, color: '#c9a227' },
  bike: { label: 'Bici', icon: Bike, color: '#3f8f7f' },
  ferry: { label: 'Traghetto', icon: Ship, color: '#3a7ca5' },
  plane: { label: 'Aereo', icon: Plane, color: '#6b5b95' },
  unknown: { label: 'Mezzo?', icon: CircleQuestionMark, color: '#a39e93' },
}

export const TRANSPORT_ORDER = Object.keys(TRANSPORT) as TransportMode[]

export const PRECISION: Record<TimePrecision, { label: string; short: string }> = {
  exact: { label: 'Orario esatto', short: '' },
  approximate: { label: 'Circa', short: 'circa' },
  morning: { label: 'Mattina', short: 'mattina' },
  afternoon: { label: 'Pomeriggio', short: 'pom.' },
  evening: { label: 'Sera', short: 'sera' },
  unknown: { label: 'Non so', short: '' },
}

/** Precisioni che non richiedono un orario. */
export const PERIOD_PRECISIONS: TimePrecision[] = ['morning', 'afternoon', 'evening']
