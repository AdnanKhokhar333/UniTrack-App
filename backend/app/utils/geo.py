"""Simple Haversine helpers for fuel estimates (no external deps)."""

import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def path_distance_km(points: list[tuple[float, float]]) -> float:
    """Sum consecutive Haversine segments. `points` = [(lat, lng), ...]."""
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(points)):
        lat1, lon1 = points[i - 1]
        lat2, lon2 = points[i]
        total += haversine_km(lat1, lon1, lat2, lon2)
    return total
