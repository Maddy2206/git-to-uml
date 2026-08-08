class Animal:
    """Base animal."""

    def __init__(self, name: str):
        self.name = name
        self._age = 0

    def speak(self) -> str:
        raise NotImplementedError
