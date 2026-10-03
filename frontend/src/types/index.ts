import type { components } from '@/types/api.gen'

type Schemas = components['schemas']

export type TripSummary = Schemas['TripSummary']
export type TripDetail = Schemas['TripDetail']
export type TripCreate = Schemas['TripCreate']
export type TripUpdate = Schemas['TripUpdate']
export type Day = Schemas['DayOut']
export type DayUpdate = Schemas['DayUpdate']
export type Stop = Schemas['StopOut']
export type StopCreate = Schemas['StopCreate']
export type StopUpdate = Schemas['StopUpdate']
export type Segment = Schemas['SegmentOut']
export type SegmentUpdate = Schemas['SegmentUpdate']

export type TripKind = Schemas['TripKind']
export type StopCategory = Schemas['StopCategory']
export type TimePrecision = Schemas['TimePrecision']
export type TransportMode = Schemas['TransportMode']
