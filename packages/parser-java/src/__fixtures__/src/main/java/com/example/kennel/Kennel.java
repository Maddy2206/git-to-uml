package com.example.kennel;

import com.example.animals.Dog;

public class Kennel {
    private final Dog dog;

    public Kennel(Dog dog) {
        this.dog = dog;
    }

    public Dog house() {
        return this.dog;
    }
}
