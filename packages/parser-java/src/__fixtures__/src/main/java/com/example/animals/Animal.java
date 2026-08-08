package com.example.animals;

public abstract class Animal {
    private String name;
    protected int age = 0;

    public Animal(String name) {
        this.name = name;
    }

    public abstract String speak();

    public String getName() {
        return this.name;
    }
}
