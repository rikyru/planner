"""Enum di dominio. Salvati come varchar + CHECK (native_enum=False): aggiungere un valore
è una migrazione semplice, a differenza degli enum nativi di PostgreSQL."""

from enum import StrEnum


class TripKind(StrEnum):
    plan = "plan"
    reconstruct = "reconstruct"


class Visibility(StrEnum):
    private = "private"
    unlisted = "unlisted"


class StopCategory(StrEnum):
    attraction = "attraction"
    food = "food"
    hotel = "hotel"
    transport = "transport"
    parking = "parking"
    nature = "nature"
    shopping = "shopping"
    nightlife = "nightlife"
    custom = "custom"


class TimePrecision(StrEnum):
    exact = "exact"
    approximate = "approximate"
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    unknown = "unknown"


class TransportMode(StrEnum):
    walking = "walking"
    subway = "subway"
    train = "train"
    bus = "bus"
    car = "car"
    taxi = "taxi"
    bike = "bike"
    ferry = "ferry"
    plane = "plane"
    unknown = "unknown"
