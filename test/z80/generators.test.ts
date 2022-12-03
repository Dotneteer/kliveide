import "mocha";

describe("Z80 generators", () => {
    it("BIT ops generator", ()=> {
        const regNames = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            for (let reg = 0; reg < 8; reg++) {
                const code = 0x40 + 8 * bit + reg;
                let text = `// 0x${code.toString(16).toUpperCase()}: BIT ${bit},${regNames[reg]}\n`;
                text += `function bit${bit}${(reg === 6 ? 'Hli' : regNames[reg])}(cpu: Z80Cpu) {\n`;
                if (reg === 6) {
                    text += `    const tmp = cpu.readMemory(cpu.hl);\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.hl);\n`;
                    text += `    cpu.bit8W(${bit}, tmp);\n`
                } else {
                    text += `    cpu.bit8(${bit}, cpu.${regNames[reg].toLowerCase()});\n`
                }
                text += "}\n"
                console.log(text);
            }
        }
    });

    it("Generate BIT jump table", () => {
        const regNames = ["B", "C", "D", "E", "H", "L", "Hli", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            let line = "        ";
            for (let reg = 0; reg < 8; reg++) {
                line += `xbit${bit},`.padEnd(10, " ");
            }
            line += `// ${(0x40+8*bit).toString(16)}-${(0x47+8*bit).toString(16)}`
            console.log(line);
        }
    });

    it("RES ops generator", ()=> {
        const regNames = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            for (let reg = 0; reg < 8; reg++) {
                const code = 0x80 + 8 * bit + reg;
                let text = `// 0x${code.toString(16).toUpperCase()}: RES ${bit},${regNames[reg]}\n`;
                text += `function res${bit}${(reg === 6 ? 'Hli' : regNames[reg])}(cpu: Z80Cpu) {\n`;
                const mask = ~(1 << bit) & 0xff;
                if (reg === 6) {
                    text += `    const tmp = cpu.readMemory(cpu.hl) & 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.hl);\n`;
                    text += `    cpu.writeMemory(cpu.hl, tmp);\n`
                } else {
                    text += `    cpu.${regNames[reg].toLowerCase()} &= 0x${mask.toString(16)};\n`
                }
                text += "}\n"
                console.log(text);
            }
        }
    });

    it("Generate RES jump table", () => {
        const regNames = ["B", "C", "D", "E", "H", "L", "Hli", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            let line = "        ";
            for (let reg = 0; reg < 8; reg++) {
                line += `res${bit}${regNames[reg]},`.padEnd(10, " ");
            }
            line += `// ${(0x80+8*bit).toString(16)}-${(0x87+8*bit).toString(16)}`
            console.log(line);
        }
    });

    it("SET ops generator", ()=> {
        const regNames = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            for (let reg = 0; reg < 8; reg++) {
                const code = 0xC0 + 8 * bit + reg;
                let text = `// 0x${code.toString(16).toUpperCase()}: SET ${bit},${regNames[reg]}\n`;
                text += `function set${bit}${(reg === 6 ? 'Hli' : regNames[reg])}(cpu: Z80Cpu) {\n`;
                const mask = 1 << bit;
                if (reg === 6) {
                    text += `    const tmp = cpu.readMemory(cpu.hl) | 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.hl);\n`;
                    text += `    cpu.writeMemory(cpu.hl, tmp);\n`
                } else {
                    text += `    cpu.${regNames[reg].toLowerCase()} |= 0x${mask.toString(16)};\n`
                }
                text += "}\n"
                console.log(text);
            }
        }
    });

    it("Generate SET jump table", () => {
        const regNames = ["B", "C", "D", "E", "H", "L", "Hli", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            let line = "        ";
            for (let reg = 0; reg < 8; reg++) {
                line += `set${bit}${regNames[reg]},`.padEnd(10, " ");
            }
            line += `// ${(0xc0+8*bit).toString(16)}-${(0xc7+8*bit).toString(16)}`
            console.log(line);
        }
    });

    it("XRES ops generator", ()=> {
        const regNames = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            for (let reg = 0; reg < 8; reg++) {
                const code = 0x80 + 8 * bit + reg;
                let text = `// 0x${code.toString(16).toUpperCase()}: RES ${bit},(IX+d)${reg === 6 ? '' : ',' + regNames[reg]}\n`;
                text += `function xres${bit}${(reg === 6 ? '' : regNames[reg])}(cpu: Z80Cpu) {\n`;
                const mask = ~(1 << bit) & 0xff;
                if (reg === 6) {
                    text += `    const tmp = cpu.readMemory(cpu.wz) & 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.wz);\n`;
                    text += `    cpu.writeMemory(cpu.wz, tmp);\n`
                } else {
                    text += `    cpu.${regNames[reg].toLowerCase()} = cpu.readMemory(cpu.wz) & 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.wz);\n`;
                    text += `    cpu.writeMemory(cpu.wz, cpu.${regNames[reg].toLowerCase()});\n`
                }
                text += "}\n"
                console.log(text);
            }
        }
    });

    it("Generate XRES jump table", () => {
        const regNames = ["B", "C", "D", "E", "H", "L", "Hli", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            let line = "        ";
            for (let reg = 0; reg < 8; reg++) {
                line += `xres${bit}${reg === 6 ? "" : regNames[reg]},`.padEnd(10, " ");
            }
            line += `// ${(0x80+8*bit).toString(16)}-${(0x87+8*bit).toString(16)}`
            console.log(line);
        }
    });

    it("XSET ops generator", ()=> {
        const regNames = ["B", "C", "D", "E", "H", "L", "(HL)", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            for (let reg = 0; reg < 8; reg++) {
                const code = 0xC0 + 8 * bit + reg;
                let text = `// 0x${code.toString(16).toUpperCase()}: RES ${bit},(IX+d)${reg === 6 ? '' : ',' + regNames[reg]}\n`;
                text += `function xset${bit}${(reg === 6 ? '' : regNames[reg])}(cpu: Z80Cpu) {\n`;
                const mask = 1 << bit;
                if (reg === 6) {
                    text += `    const tmp = cpu.readMemory(cpu.wz) | 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.wz);\n`;
                    text += `    cpu.writeMemory(cpu.wz, tmp);\n`
                } else {
                    text += `    cpu.${regNames[reg].toLowerCase()} = cpu.readMemory(cpu.wz) | 0x${mask.toString(16)};\n`;
                    text += `    cpu.tactPlus1WithAddress(cpu.wz);\n`;
                    text += `    cpu.writeMemory(cpu.wz, cpu.${regNames[reg].toLowerCase()});\n`
                }
                text += "}\n"
                console.log(text);
            }
        }
    });

    it("Generate XSET jump table", () => {
        const regNames = ["B", "C", "D", "E", "H", "L", "Hli", "A"]
        // --- Arrange
        for (let bit = 0; bit < 8; bit++) {
            let line = "        ";
            for (let reg = 0; reg < 8; reg++) {
                line += `xset${bit}${reg === 6 ? "" : regNames[reg]},`.padEnd(10, " ");
            }
            line += `// ${(0x80+8*bit).toString(16)}-${(0x87+8*bit).toString(16)}`
            console.log(line);
        }
    });

});
