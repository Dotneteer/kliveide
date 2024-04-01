import "mocha";
import { expect } from "expect";
import { InputStream } from "@common/ksx/InputStream";

describe("KSX - InputStream", () => {
  it("Builds from string", () => {
    // --- Act
    const is = new InputStream("hello");

    // --- Assert
    expect(is.position).toEqual(0);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(0);
    expect(is.source).toEqual("hello");
  });

  it("Peek #1", () => {
    // --- Arrange
    const is = new InputStream("hello");

    // --- Act
    const ch = is.peek();

    // --- Assert
    expect(ch).toEqual("h");
    expect(is.position).toEqual(0);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(0);
  });

  it("Peek #3", () => {
    // --- Arrange
    const is = new InputStream("hello");
    is.get();
    is.get();

    // --- Act
    const ch = is.peek();

    // --- Assert
    expect(ch).toEqual("l");
    expect(is.position).toEqual(2);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(2);
  });

  it("Peek #5", () => {
    // --- Arrange
    const is = new InputStream("hello");
    is.get();
    is.get();
    is.get();
    is.get();
    is.get();

    // --- Act
    const ch = is.peek();

    // --- Assert
    expect(ch).toEqual(null);
    expect(is.position).toEqual(5);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(5);
  });

  it("Peek with new line #1", () => {
    // --- Arrange
    const is = new InputStream("he\nllo");
    is.get();
    is.get();

    // --- Act
    const ch = is.peek();

    // --- Assert
    expect(ch).toEqual("\n");
    expect(is.position).toEqual(2);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(2);
  });

  it("Get #1", () => {
    // --- Arrange
    const is = new InputStream("hello");

    // --- Act
    const ch = is.get();

    // --- Assert
    expect(ch).toEqual("h");
    expect(is.position).toEqual(1);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(1);
  });

  it("Get #3", () => {
    // --- Arrange
    const is = new InputStream("hello");
    is.get();
    is.get();

    // --- Act
    const ch = is.get();

    // --- Assert
    expect(ch).toEqual("l");
    expect(is.position).toEqual(3);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(3);
  });

  it("Get #5", () => {
    // --- Arrange
    const is = new InputStream("hello");
    is.get();
    is.get();
    is.get();
    is.get();
    is.get();

    // --- Act
    const ch = is.get();

    // --- Assert
    expect(ch).toEqual(null);
    expect(is.position).toEqual(5);
    expect(is.line).toEqual(1);
    expect(is.column).toEqual(5);
  });

  it("Get with new line #1", () => {
    // --- Arrange
    const is = new InputStream("he\nllo");
    is.get();
    is.get();

    // --- Act
    const ch = is.get();

    // --- Assert
    expect(ch).toEqual("\n");
    expect(is.position).toEqual(3);
    expect(is.line).toEqual(2);
    expect(is.column).toEqual(0);
  });
});
