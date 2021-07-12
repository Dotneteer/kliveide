import * as expect from "expect";
import * as _ from "lodash";
import {
  DisassemblyAnnotation,
  MAX_LABEL_LENGTH,
} from "../../src/disassembler/annotations";
import {
  MemorySection,
  MemorySectionType,
} from "../../src/disassembler/disassembly-helper";

describe("Disassembler - annotations", function() {
  this.timeout(10000);
  it("Construction works as expected", () => {
    // --- Act
    const dc = new DisassemblyAnnotation();

    // --- Assert
    expect(dc.labels.size).toBe(0);
    expect(dc.comments.size).toBe(0);
    expect(dc.prefixComments.size).toBe(0);
    expect(dc.literals.size).toBe(0);
  });

  it("SetLabel does not save invalid label", () => {
    // --- Arrange
    const LABEL = "My$$Label$$";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setLabel(0x1000, LABEL);

    // --- Assert
    expect(result).toBe(false);
    expect(dc.labels.size).toBe(0);
  });

  it("SetLabel truncates too long label", () => {
    // --- Arrange
    const LABEL = "Label012345678901234567890123456789";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setLabel(0x1000, LABEL);

    // --- Assert
    expect(result).toBe(true);
    expect(dc.labels.size).toBe(1);
    expect(dc.labels.get(0x1000)).toBe(LABEL.substring(0, MAX_LABEL_LENGTH));
  });

  it("SetLabel works as expected", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setLabel(0x1000, LABEL);

    // --- Assert
    expect(result).toBe(true);
    expect(dc.labels.size).toBe(1);
    expect(dc.labels.get(0x1000)).toBe(LABEL);
  });

  it("SetLabel does not duplicate label", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const dc = new DisassemblyAnnotation();
    dc.setLabel(0x1000, LABEL);

    // --- Act
    const result = dc.setLabel(0x1100, LABEL);

    // --- Assert
    expect(result).toBe(false);
    expect(dc.labels.size).toBe(1);
    expect(dc.labels.get(0x1000)).toBe(LABEL);
  });

  it("SetLabel works with multiple label", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    var dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.setLabel(0x1000, LABEL);
    const result2 = dc.setLabel(0x2000, LABEL2);

    // --- Assert
    expect(result1).toBe(true);
    expect(dc.labels.size).toBe(2);
    expect(dc.labels.get(0x1000)).toBe(LABEL);
    expect(result2).toBe(true);
    expect(dc.labels.get(0x2000)).toBe(LABEL2);
  });

  it("SetLabel overrides existing label", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    var dc = new DisassemblyAnnotation();
    const result = dc.setLabel(0x1000, LABEL);

    // --- Act
    const result2 = dc.setLabel(0x1000, LABEL2);

    // --- Assert
    expect(result).toBe(true);
    expect(dc.labels.size).toBe(1);
    expect(dc.labels.get(0x1000)).toBe(LABEL2);
  });

  it("SetLabel removes undefined label", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    var dc = new DisassemblyAnnotation();
    dc.setLabel(0x1000, LABEL);

    // --- Act
    const result = dc.setLabel(0x1000, undefined);

    // --- Assert
    expect(result).toBe(true);
    expect(dc.labels.size).toBe(0);
  });

  it("SetLabel removes whitespace label", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    var dc = new DisassemblyAnnotation();
    dc.setLabel(0x1000, LABEL);

    // --- Act
    const result = dc.setLabel(0x1000, "  \t\t  ");

    // --- Assert
    expect(result).toBe(true);
    expect(dc.labels.size).toBe(0);
  });

  it("SetLabel handles no remove", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    var dc = new DisassemblyAnnotation();
    dc.setLabel(0x1000, LABEL);

    // --- Act
    const result = dc.setLabel(0x2000, undefined);

    // --- Assert
    expect(result).toBe(false);
    expect(dc.labels.size).toBe(1);
  });

  it("SetComment works as expected", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setComment(0x1000, COMMENT);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.comments.size).toBe(1);
    expect(dc.comments.get(0x1000)).toBe(COMMENT);
  });

  it("SetComment works with multiple comments", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const COMMENT2 = "MyComment2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.setComment(0x1000, COMMENT);
    const result2 = dc.setComment(0x2000, COMMENT2);

    // --- Assert
    expect(dc.comments.size).toBe(2);
    expect(result1).toBeTruthy();
    expect(dc.comments.get(0x1000)).toBe(COMMENT);
    expect(result2).toBeTruthy();
    expect(dc.comments.get(0x2000)).toBe(COMMENT2);
  });

  it("SetComment overwites existing comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const COMMENT2 = "MyComment2";
    const dc = new DisassemblyAnnotation();
    dc.setComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setComment(0x1000, COMMENT2);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.comments.get(0x1000)).toBe(COMMENT2);
  });

  it("SetComment removes undefined comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setComment(0x1000, undefined);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.comments.size).toBe(0);
  });

  it("SetComment removes whitespace comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setComment(0x1000, "  \t\t  ");

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.comments.size).toBe(0);
  });

  it("SetComment handle no remove", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setComment(0x2000, undefined);

    // --- Assert
    expect(result).toBeFalsy();
    expect(dc.comments.size).toBe(1);
  });

  it("SetPrefixComment works as expected", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setPrefixComment(0x1000, COMMENT);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.prefixComments.size).toBe(1);
    expect(dc.prefixComments.get(0x1000)).toBe(COMMENT);
  });

  it("SetPrefixComment works with multiple comments", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const COMMENT2 = "MyComment2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.setPrefixComment(0x1000, COMMENT);
    const result2 = dc.setPrefixComment(0x2000, COMMENT2);

    // --- Assert
    expect(dc.prefixComments.size).toBe(2);
    expect(result1).toBeTruthy();
    expect(dc.prefixComments.get(0x1000)).toBe(COMMENT);
    expect(result2).toBeTruthy();
    expect(dc.prefixComments.get(0x2000)).toBe(COMMENT2);
  });

  it("SetPrefixComment overwites existing comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const COMMENT2 = "MyComment2";
    const dc = new DisassemblyAnnotation();
    dc.setPrefixComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setPrefixComment(0x1000, COMMENT2);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.prefixComments.get(0x1000)).toBe(COMMENT2);
  });

  it("SetPrefixComment removes undefined comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setPrefixComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setPrefixComment(0x1000, undefined);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.prefixComments.size).toBe(0);
  });

  it("SetPrefixComment removes whitespace comment", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setPrefixComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setPrefixComment(0x1000, "  \t\t  ");

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.prefixComments.size).toBe(0);
  });

  it("SetPrefixComment handle no remove", () => {
    // --- Arrange
    const COMMENT = "MyComment";
    const dc = new DisassemblyAnnotation();
    dc.setPrefixComment(0x1000, COMMENT);

    // --- Act
    const result = dc.setPrefixComment(0x2000, undefined);

    // --- Assert
    expect(result).toBeFalsy();
    expect(dc.prefixComments.size).toBe(1);
  });

  it("AddLiteral works as expected", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.addLiteral(0x1000, LABEL);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literals.size).toBe(1);
    const literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(1);
    expect(_.includes(literals, LABEL)).toBeTruthy();
  });

  it("AddLiteral works with multiple literals", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.addLiteral(0x1000, LABEL);
    const result2 = dc.addLiteral(0x2000, LABEL2);

    // --- Assert
    expect(dc.literals.size).toBe(2);
    expect(result1).toBeTruthy();
    let literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(1);
    expect(_.includes(literals, LABEL)).toBeTruthy();
    expect(result2).toBeTruthy();
    literals = dc.literals.get(0x2000) || [];
    expect(literals.length).toBe(1);
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("AddLiteral works with multiple names", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.addLiteral(0x1000, LABEL);
    const result2 = dc.addLiteral(0x1000, LABEL2);

    // --- Assert
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(dc.literals.size).toBe(1);
    let literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(2);
    expect(_.includes(literals, LABEL)).toBeTruthy();
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("AddLiteral stores distinct names", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.addLiteral(0x1000, LABEL);
    const result2 = dc.addLiteral(0x1000, LABEL2);
    const result3 = dc.addLiteral(0x1000, LABEL);

    // --- Assert
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(result3).toBeFalsy();
    expect(dc.literals.size).toBe(1);
    let literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(2);
    expect(_.includes(literals, LABEL)).toBeTruthy();
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("AddLiteral does not allow different keys for the same name", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.addLiteral(0x1000, LABEL);
    const result2 = dc.addLiteral(0x1000, LABEL2);
    const result3 = dc.addLiteral(0x2000, LABEL);

    // --- Assert
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(result3).toBeFalsy();
    expect(dc.literals.size).toBe(1);
    let literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(2);
    expect(_.includes(literals, LABEL)).toBeTruthy();
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("RemoveLiteral works as expected", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();
    dc.addLiteral(0x1000, LABEL);

    // --- Act
    const result = dc.removeLiteral(0x1000, LABEL);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literals.size).toBe(0);
  });

  it("RemoveLiteral keeps untouched names", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();
    dc.addLiteral(0x1000, LABEL);
    dc.addLiteral(0x1000, LABEL2);

    // --- Act
    const result = dc.removeLiteral(0x1000, LABEL);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literals.size).toBe(1);
    let literals = dc.literals.get(0x1000) || [];
    expect(literals.length).toBe(1);
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("RemoveLiteral keeps untouched keys", () => {
    // --- Arrange
    const LABEL = "MyLabel";
    const LABEL2 = "MyLabel2";
    const dc = new DisassemblyAnnotation();
    dc.addLiteral(0x1000, LABEL);
    dc.addLiteral(0x2000, LABEL2);

    // --- Act
    const result = dc.removeLiteral(0x1000, LABEL);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literals.size).toBe(1);
    let literals = dc.literals.get(0x2000) || [];
    expect(literals.length).toBe(1);
    expect(_.includes(literals, LABEL2)).toBeTruthy();
  });

  it("SetLiteralReplacement works as expected", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literalReplacements.size).toBe(1);
    expect(dc.literalReplacements.get(0x1000)).toBe(REPLACEMENT);
  });

  it("SetLiteralReplacement works with multiple replacements", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const REPLACEMENT2 = "MyReplacement2";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result1 = dc.setLiteralReplacement(0x1000, REPLACEMENT);
    const result2 = dc.setLiteralReplacement(0x2000, REPLACEMENT2);

    // --- Assert
    expect(dc.literalReplacements.size).toBe(2);
    expect(result1).toBeTruthy();
    expect(dc.literalReplacements.get(0x1000)).toBe(REPLACEMENT);
    expect(result2).toBeTruthy();
    expect(dc.literalReplacements.get(0x2000)).toBe(REPLACEMENT2);
  });

  it("SetLiteralReplacement overwrites existing replacement", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const REPLACEMENT2 = "MyReplacement2";
    const dc = new DisassemblyAnnotation();
    dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Act
    const result = dc.setLiteralReplacement(0x1000, REPLACEMENT2);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literalReplacements.size).toBe(1);
    expect(dc.literalReplacements.get(0x1000)).toBe(REPLACEMENT2);
  });

  it("SetLiteralReplacement removes undefined replacement", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const REPLACEMENT2 = "MyReplacement2";
    const dc = new DisassemblyAnnotation();
    dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Act
    const result = dc.setLiteralReplacement(0x1000, undefined);

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literalReplacements.size).toBe(0);
  });

  it("SetLiteralReplacement removes whitespace replacement", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const REPLACEMENT2 = "MyReplacement2";
    const dc = new DisassemblyAnnotation();
    dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Act
    const result = dc.setLiteralReplacement(0x1000, "  \t\t  ");

    // --- Assert
    expect(result).toBeTruthy();
    expect(dc.literalReplacements.size).toBe(0);
  });

  it("SetLiteralReplacement handles no remove", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();
    dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Act
    const result = dc.setLiteralReplacement(0x2000, undefined);

    // --- Assert
    expect(result).toBeFalsy();
    expect(dc.literalReplacements.size).toBe(1);
  });

  it("ApplyLiteral removes replacement", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();
    dc.setLiteralReplacement(0x1000, REPLACEMENT);

    // --- Act
    const result = dc.applyLiteral(0x1000, 0x0000, undefined);

    // --- Assert
    expect(result).toBeFalsy();
    expect(dc.literalReplacements.size).toBe(0);
  });

  it("ApplyLiteral creates new symbol", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();

    // --- Act
    const result = dc.applyLiteral(0x1000, 0x2000, REPLACEMENT);

    // --- Assert
    expect(result).toBeFalsy();
    const literals = dc.literals.get(0x2000) || [];
    expect(literals.length).toBe(1);
    expect(literals[0]).toBe(REPLACEMENT);
    expect(dc.literalReplacements.size).toBe(1);
    expect(dc.literalReplacements.get(0x1000)).toBe(REPLACEMENT);
  });

  it("ApplyLiteral uses existing symbol", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();
    dc.addLiteral(0x2000, REPLACEMENT);

    // --- Act
    const result = dc.applyLiteral(0x1000, 0x2000, REPLACEMENT);

    // --- Assert
    expect(result).toBeFalsy();
    const literals = dc.literals.get(0x2000) || [];
    expect(literals.length).toBe(1);
    expect(literals[0]).toBe(REPLACEMENT);
    expect(dc.literalReplacements.size).toBe(1);
    expect(dc.literalReplacements.get(0x1000)).toBe(REPLACEMENT);
  });

  it("ApplyLiteral wrong symbol value", () => {
    // --- Arrange
    const REPLACEMENT = "MyReplacement";
    const dc = new DisassemblyAnnotation();
    dc.addLiteral(0x3000, REPLACEMENT);

    // --- Act
    const result = dc.applyLiteral(0x1000, 0x2000, REPLACEMENT);

    // --- Assert
    expect(result).toBeTruthy();
    const literals = dc.literals.get(0x3000) || [];
    expect(literals.length).toBe(1);
    expect(literals[0]).toBe(REPLACEMENT);
    expect(dc.literalReplacements.size).toBe(0);
  });

  it("Serialization works as expected", () => {
    // --- Arrange
    var dc = new DisassemblyAnnotation();
    dc.setLabel(0x0100, "FirstLabel");
    dc.setLabel(0x0200, "SecondLabel");
    dc.setComment(0x0100, "FirstComment");
    dc.setComment(0x0200, "SecondComment");
    dc.setPrefixComment(0x0100, "FirstPrefixComment");
    dc.setPrefixComment(0x0200, "SecondPrefixComment");
    dc.addLiteral(0x0000, "Entry");
    dc.addLiteral(0x0000, "Start");
    dc.addLiteral(0x0028, "Calculator");
    dc.memoryMap.add(new MemorySection(0x0000, 0x3bff));
    dc.memoryMap.add(
      new MemorySection(0x3c00, 0x3fff, MemorySectionType.ByteArray)
    );
    dc.setLiteralReplacement(0x100, "Entry");
    dc.setLiteralReplacement(0x1000, "Calculator");

    // --- Act
    const serialized = dc.serialize();
    const result = DisassemblyAnnotation.deserialize(serialized);

    // --- Assert
    expect(result).toBeTruthy();
    const back = result || new DisassemblyAnnotation();
    expect(dc.labels.size).toBe(back.labels.size);
    for (const item of dc.labels) {
      expect(back.labels.get(item[0])).toBe(item[1]);
    }
    expect(dc.comments.size).toBe(back.comments.size);
    for (const item of dc.comments) {
      expect(back.comments.get(item[0])).toBe(item[1]);
    }
    expect(dc.prefixComments.size).toBe(back.prefixComments.size);
    for (const item of dc.prefixComments) {
      expect(back.prefixComments.get(item[0])).toBe(item[1]);
    }
    expect(dc.literals.size).toBe(back.literals.size);
    for (const item of dc.literals) {
      (back.literals.get(item[0]) || []).forEach((v) =>
        expect(_.includes(dc.literals.get(item[0]), v))
      );
      (dc.literals.get(item[0]) || []).forEach((v) =>
        expect(_.includes(back.literals.get(item[0]), v))
      );
    }
    expect(dc.literalReplacements.size).toBe(back.literalReplacements.size);
    for (const item of dc.literalReplacements) {
      expect(back.literalReplacements.get(item[0])).toBe(item[1]);
    }
    expect(dc.memoryMap.count).toBe(back.memoryMap.count);
    for (let i = 0; i < dc.memoryMap.count; i++) {
      expect(
        dc.memoryMap.sections[i].equals(back.memoryMap.sections[i])
      ).toBeTruthy();
    }
  });

  it("Merge works as expected", () => {
    // --- Arrange
    var dc = new DisassemblyAnnotation();
    dc.setLabel(0x0100, "FirstLabel");
    dc.setLabel(0x0200, "SecondLabel");
    dc.setComment(0x0100, "FirstComment");
    dc.setComment(0x0200, "SecondComment");
    dc.setPrefixComment(0x0100, "FirstPrefixComment");
    dc.setPrefixComment(0x0200, "SecondPrefixComment");
    dc.addLiteral(0x0000, "Entry");
    dc.addLiteral(0x0000, "Start");
    dc.addLiteral(0x0028, "Calculator");
    dc.memoryMap.add(new MemorySection(0x0000, 0x3bff));
    dc.memoryMap.add(
      new MemorySection(0x3c00, 0x3fff, MemorySectionType.ByteArray)
    );
    dc.setLiteralReplacement(0x100, "Entry");
    dc.setLiteralReplacement(0x1000, "Calculator");

    // --- Act
    var odc = new DisassemblyAnnotation();
    odc.setLabel(0x0200, "SecondLabelA");
    odc.setLabel(0x0300, "ThirdLabel");
    odc.setComment(0x0100, "FirstCommentA");
    odc.setComment(0x0300, "ThirdComment");
    odc.setPrefixComment(0x0200, "SecondPrefixCommentA");
    odc.setPrefixComment(0x0300, "ThirdPrefixComment");
    odc.addLiteral(0x0000, "Start");
    odc.addLiteral(0x0028, "CalculatorA");
    odc.memoryMap.add(
      new MemorySection(0x3c00, 0x5bff, MemorySectionType.ByteArray)
    );
    odc.setLiteralReplacement(0x100, "Entry");
    odc.setLiteralReplacement(0x200, "Other");
    odc.setLiteralReplacement(0x1000, "CalculatorA");
    dc.merge(odc);

    // --- Assert
    expect(dc.labels.size).toBe(3);
    expect(dc.labels.get(0x100)).toBe("FirstLabel");
    expect(dc.labels.get(0x200)).toBe("SecondLabelA");
    expect(dc.labels.get(0x300)).toBe("ThirdLabel");
    expect(dc.comments.size).toBe(3);
    expect(dc.comments.get(0x100)).toBe("FirstCommentA");
    expect(dc.comments.get(0x200)).toBe("SecondComment");
    expect(dc.comments.get(0x300)).toBe("ThirdComment");
    expect(dc.prefixComments.size).toBe(3);
    expect(dc.prefixComments.get(0x100)).toBe("FirstPrefixComment");
    expect(dc.prefixComments.get(0x200)).toBe("SecondPrefixCommentA");
    expect(dc.prefixComments.get(0x300)).toBe("ThirdPrefixComment");
    expect(dc.literals.size).toBe(2);
    expect((dc.literals.get(0x0000) || []).length).toBe(2);
    expect(_.includes(dc.literals.get(0x0000), "Start")).toBeTruthy();
    expect(_.includes(dc.literals.get(0x0000), "Entry")).toBeTruthy();
    expect((dc.literals.get(0x0028) || []).length).toBe(2);
    expect(_.includes(dc.literals.get(0x0028), "Calculator")).toBeTruthy();
    expect(_.includes(dc.literals.get(0x0028), "CalculatorA")).toBeTruthy();
    expect(dc.memoryMap.count).toBe(2);
    expect(
      dc.memoryMap.sections[0].equals(new MemorySection(0x0000, 0x3bff))
    ).toBeTruthy();
    expect(
      dc.memoryMap.sections[1].equals(
        new MemorySection(0x3c00, 0x5bff, MemorySectionType.ByteArray)
      )
    ).toBeTruthy();
    expect(dc.literalReplacements.size).toBe(3);
    expect(dc.literalReplacements.get(0x100)).toBe("Entry");
    expect(dc.literalReplacements.get(0x200)).toBe("Other");
    expect(dc.literalReplacements.get(0x1000)).toBe("CalculatorA");
  });
});
