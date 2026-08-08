package com.example.animals;

public class Dog extends Animal implements Feedable {
    private String breed;

    public Dog(String name, String breed) {
        super(name);
        this.breed = breed;
    }

    @Override
    public String speak() {
        return "Woof";
    }

    @Override
    public void feed(int amount) {
    }

    public static Dog create(String name) {
        return new Dog(name, "unknown");
    }
}
