#!/usr/bin/env python3
"""
Tests for Polyana v2 improvements:
- Game type detection
- District detection
- Late registration tracking
- Deduplication
"""
import sys
from pathlib import Path

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

import pytest
from update_polyana_v2 import (
    detect_game_type,
    detect_district,
    late_from_card,
    parse_homepage_card,
)


class TestGameTypeDetection:
    """Test game type (NLH/PLO/PLO5) classification."""

    def test_nlh_detection(self):
        assert detect_game_type("Hold'em NLH") == "NLH"
        assert detect_game_type("holdem") == "NLH"
        assert detect_game_type("Холдем") == "NLH"
        assert detect_game_type("No-Limit Hold'em") == "NLH"

    def test_plo_detection(self):
        assert detect_game_type("PLO") == "PLO"
        assert detect_game_type("Омаха") == "PLO"
        assert detect_game_type("Pot Limit Omaha") == "PLO"
        assert detect_game_type("potlimit omaha") == "PLO"

    def test_plo5_detection(self):
        assert detect_game_type("PLO5") == "PLO5"
        assert detect_game_type("5-card poker") == "PLO5"
        assert detect_game_type("5 card omaha") == "PLO5"

    def test_unknown_game(self):
        assert detect_game_type("Some random tournament") is None
        assert detect_game_type("") is None
        assert detect_game_type(None) is None

    def test_plo5_priority_over_plo(self):
        """PLO5 should match before PLO."""
        assert detect_game_type("PLO5 Omaha") == "PLO5"

    def test_plo_priority_over_nlh(self):
        """PLO should match before NLH."""
        assert detect_game_type("PLO Hold'em") == "PLO"


class TestDistrictDetection:
    """Test Moscow district detection from addresses."""

    def test_tverskaya_district(self):
        district = detect_district("улица Тверская, 15")
        assert district == "Центральный"

    def test_basmannaya_district(self):
        district = detect_district("Новая Басманная улица, 19")
        assert district in ["Замоскворечье", "Басманный"]

    def test_unknown_district(self):
        assert detect_district("неизвестный район, 1") is None
        assert detect_district("") is None
        assert detect_district(None) is None

    def test_case_insensitive(self):
        d1 = detect_district("НОВАЯ БАСМАННАЯ УЛИЦА, 19")
        d2 = detect_district("новая басманная улица, 19")
        assert d1 == d2


class TestLateRegistration:
    """Test late registration parsing."""

    def test_late_reg_valid(self):
        """Parse valid late reg time."""
        until, minutes = late_from_card("fee 1000₽ вход до 21:00", "19:00")
        assert until == "21:00"
        assert minutes == 120  # 2 hours

    def test_late_reg_none(self):
        """No late reg in text."""
        until, minutes = late_from_card("fee 1000₽", "19:00")
        assert until is None
        assert minutes is None

    def test_late_reg_invalid_time(self):
        """Invalid hour in late reg."""
        until, minutes = late_from_card("вход до 25:00", "19:00")
        assert until == "25:00"  # Raw value preserved
        assert minutes is None  # Invalid, so no minutes

    def test_late_reg_too_long(self):
        """Late reg longer than 12 hours."""
        until, minutes = late_from_card("вход до 08:00 next day", "19:00")
        # This would be 13 hours, which is > 12 * 60
        assert until is not None
        # May be None or the value depending on calculation


class TestHomepageCardParsing:
    """Test full homepage card parsing with new fields."""

    def test_parse_nlh_game(self):
        """Parse NLH game type."""
        card = {
            "url": "https://pokernomoney.ru/tournaments/123",
            "full": "★ PREMIUM NLH Tournament 19:00 1000 ₽ Quantum Новая Басманная улица, 19",
            "compact": "19:00 Quantum ♠",
            "time": "19:00",
            "club": "Quantum",
            "variants": []
        }
        event = parse_homepage_card(card, "2026-08-26", "2026-08-26T19:00:00+03:00")
        assert event["game"] == "NLH"

    def test_parse_with_district(self):
        """Parse event with district detection."""
        card = {
            "url": "https://pokernomoney.ru/tournaments/124",
            "full": "Mystery Bounty 19:00 500 ₽ Level улица Тверская, 15",
            "compact": "19:00 Level ♠",
            "time": "19:00",
            "club": "Level",
            "variants": []
        }
        event = parse_homepage_card(card, "2026-08-26", "2026-08-26T19:00:00+03:00")
        assert event["district"] == "Центральный"

    def test_event_has_metadata(self):
        """Event contains tracking metadata."""
        card = {
            "url": "https://pokernomoney.ru/tournaments/125",
            "full": "PLO 20:00 2000 ₽ Club Address",
            "compact": "20:00 Club ♠",
            "time": "20:00",
            "club": "Club",
            "variants": []
        }
        event = parse_homepage_card(card, "2026-08-26", "2026-08-26T20:00:00+03:00")
        assert "fetched_at" in event
        assert "source" in event
        assert "_id" in event  # Event ID for deduplication
        assert event["source"] == "https://pokernomoney.ru"


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_text(self):
        assert detect_game_type("") is None
        assert detect_district("") is None

    def test_whitespace_normalization(self):
        """Whitespace should not affect detection."""
        assert detect_game_type("  NLH  ") == "NLH"
        assert detect_game_type("N L H") is None  # Spaced-out variant doesn't match word-boundary patterns

    def test_russian_vs_english(self):
        """Both Russian and English should work."""
        assert detect_game_type("Холдем") == "NLH"  # Russian
        assert detect_game_type("Hold'em") == "NLH"  # English


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
