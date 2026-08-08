from .dog import Dog


class Kennel:
    def __init__(self, dog: Dog):
        self.dog = dog

    def house(self) -> Dog:
        return self.dog
