import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";

describe("Parser - input stream", () => {
  it("peek: empty stream results EOF", () => {
    const is = new InputStream("");
    expect(is.peek()).toBeNull();
  });

  it("peek: keeps position", () => {
    const is = new InputStream("a");
    expect(is.peek()).toBe("a");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("ahead: empty stream results EOF", () => {
    const is = new InputStream("");
    expect(is.ahead()).toBeNull();
    expect(is.ahead(2)).toBeNull();
  });

  it("ahead: keeps position #1", () => {
    const is = new InputStream("abc");
    expect(is.ahead()).toBe("b");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("ahead: keeps position #2", () => {
    const is = new InputStream("abc");
    expect(is.ahead(2)).toBe("c");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("ahead: keeps position #3", () => {
    const is = new InputStream("abc\r\nabc");
    expect(is.ahead(3)).toBe("\r");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("ahead: keeps position #4", () => {
    const is = new InputStream("abc\r\nabc");
    expect(is.ahead(5)).toBe("\a");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("get: empty stream results EOF", () => {
    const is = new InputStream("");
    expect(is.get()).toBeNull();
  });

  it("get: correct start position", () => {
    const is = new InputStream("a");
    expect(is.position).toBe(0);
    expect(is.line).toBe(1);
    expect(is.column).toBe(0);
  });

  it("get: first char", () => {
    const is = new InputStream("a");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
  });

  it("get: second char EOF", () => {
    const is = new InputStream("a");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
    expect(is.get()).toBeNull();
  });

  it("get: second char", () => {
    const is = new InputStream("ab");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
    expect(is.get()).toBe("b");
    expect(is.position).toBe(2);
    expect(is.line).toBe(1);
    expect(is.column).toBe(2);
  });

  it("get: second char CR", () => {
    const is = new InputStream("a\r");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
    expect(is.get()).toBe("\r");
    expect(is.position).toBe(2);
    expect(is.line).toBe(1);
    expect(is.column).toBe(2);
  });

  it("get: second char LF", () => {
    const is = new InputStream("a\n");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
    expect(is.get()).toBe("\n");
    expect(is.position).toBe(2);
    expect(is.line).toBe(2);
    expect(is.column).toBe(0);
  });

  it("get: handles CRLF", () => {
    const is = new InputStream("a\r\n");
    expect(is.get()).toBe("a");
    expect(is.position).toBe(1);
    expect(is.line).toBe(1);
    expect(is.column).toBe(1);
    expect(is.get()).toBe("\r");
    expect(is.position).toBe(2);
    expect(is.line).toBe(1);
    expect(is.column).toBe(2);
    expect(is.get()).toBe("\n");
    expect(is.position).toBe(3);
    expect(is.line).toBe(2);
    expect(is.column).toBe(0);
  });
});
