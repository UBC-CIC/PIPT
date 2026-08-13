"""Utility for seeding prompt values with defaults."""


def seed_prompt(value: str | None, default_prompt: str) -> str:
    """Return default_prompt if value is None, empty, or whitespace-only;
    otherwise return value unchanged.

    Args:
        value: The prompt value to check.
        default_prompt: The fallback prompt to use when value is blank.

    Returns:
        The original value or the default prompt.
    """
    if value is None or value.strip() == "":
        return default_prompt
    return value
