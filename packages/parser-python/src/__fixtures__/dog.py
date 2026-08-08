from .animal import Animal


class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name)
        self.breed = breed
        self.__secret = "shh"

    def speak(self) -> str:
        return "Woof"

    @staticmethod
    def create(name: str) -> "Dog":
        return Dog(name, "unknown")
