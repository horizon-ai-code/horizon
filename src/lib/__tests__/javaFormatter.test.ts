import { describe, it, expect } from "vitest";
import { formatJavaCode } from "../utils/javaFormatter";

describe("javaFormatter", () => {
  it("should format messy brackets and spacing around keywords", () => {
    const raw = `public class Test{public void run(){if(x==1){System.out.println("Hello");}}}`;
    const expected = `public class Test {
    public void run() {
        if (x == 1) {
            System.out.println("Hello");
        }
    }
}
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });

  it("should normalize spacing around binary operators", () => {
    const raw = `int a=b+c;boolean flag=x!=y&&z||w==3;`;
    // Note: our operator regex handles =, !=, ==, &&, ||, >, <. 
    // It leaves '+' alone as per the list.
    const expected = `int a = b+c;
boolean flag = x != y && z || w == 3;
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });

  it("should preserve generic brackets without spacing them out", () => {
    const raw = `List<String> list=new ArrayList<>();Map<String,List<Integer>> map=new HashMap<String,List<Integer>>();`;
    const expected = `List<String> list = new ArrayList<>();
Map<String,List<Integer>> map = new HashMap<String,List<Integer>>();
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });

  it("should not format comments and string content", () => {
    const raw = `// this is if(x==1) comment
/* multi
   line if(y==2)
*/
String s = "don't space if(x==1) or a!=b here";`;
    const expected = `// this is if(x==1) comment
/* multi
   line if(y==2)
*/
String s = "don't space if(x==1) or a!=b here";
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });

  it("should keep } else { and } catch on a single line", () => {
    const raw = `try{foo();}catch(Exception e){bar();}else{baz();}`;
    const expected = `try {
    foo();
} catch (Exception e) {
    bar();
} else {
    baz();
}
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });

  it("should collapse multiple consecutive empty lines to maximum of one", () => {
    const raw = `public class Test {


    public void run() {

    }
}`;
    const expected = `public class Test {

    public void run() {

    }
}
`;
    expect(formatJavaCode(raw)).toBe(expected);
  });
});
