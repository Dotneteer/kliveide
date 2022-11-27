import "mocha";
import { expect } from "expect";
import { Z80Cpu } from "../../src/emu/z80/Z80Cpu";

describe("Z80 tests", () => {
    it("Reg A assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x1c3d;
        cpu.a = 0x2f;

        expect(cpu.a).toEqual(0x2f);
        expect(cpu.f).toEqual(0x3d);
        expect(cpu.af).toEqual(0x2f3d);
    });

    it("Reg A assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x0000;
        cpu.a = 0x122f;

        expect(cpu.a).toEqual(0x2f);
    });

    it("Reg F assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x1c3d;
        cpu.f = 0x2f;

        expect(cpu.a).toEqual(0x1c);
        expect(cpu.f).toEqual(0x2f);
        expect(cpu.af).toEqual(0x1c2f);
    });

    it("Reg F assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x0000;
        cpu.f = 0x122f;

        expect(cpu.f).toEqual(0x2f);
    });

    it("Reg AF assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x1c3d;

        expect(cpu.a).toEqual(0x1c);
        expect(cpu.f).toEqual(0x3d);
        expect(cpu.af).toEqual(0x1c3d);
    });

    it("Reg AF assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x1223ea;

        expect(cpu.af).toEqual(0x23ea);
    });

    it("Reg B assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc = 0x1c3d;
        cpu.b = 0x2f;

        expect(cpu.b).toEqual(0x2f);
        expect(cpu.c).toEqual(0x3d);
        expect(cpu.bc).toEqual(0x2f3d);
    });

    it("Reg B assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc = 0x0000;
        cpu.b = 0x122f;

        expect(cpu.b).toEqual(0x2f);
    });

    it("Reg C assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc = 0x1c3d;
        cpu.c = 0x2f;

        expect(cpu.b).toEqual(0x1c);
        expect(cpu.c).toEqual(0x2f);
        expect(cpu.bc).toEqual(0x1c2f);
    });

    it("Reg C assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc = 0x0000;
        cpu.c = 0x122f;

        expect(cpu.c).toEqual(0x2f);
    });

    it("Reg BC assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.af = 0x1c3d;

        expect(cpu.a).toEqual(0x1c);
        expect(cpu.f).toEqual(0x3d);
        expect(cpu.af).toEqual(0x1c3d);
    });

    it("Reg BC assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc = 0x1223ea;

        expect(cpu.bc).toEqual(0x23ea);
    });

    it("Reg D assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x1c3d;
        cpu.d = 0x2f;

        expect(cpu.d).toEqual(0x2f);
        expect(cpu.e).toEqual(0x3d);
        expect(cpu.de).toEqual(0x2f3d);
    });

    it("Reg D assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x0000;
        cpu.d = 0x122f;

        expect(cpu.d).toEqual(0x2f);
    });

    it("Reg E assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x1c3d;
        cpu.e = 0x2f;

        expect(cpu.d).toEqual(0x1c);
        expect(cpu.e).toEqual(0x2f);
        expect(cpu.de).toEqual(0x1c2f);
    });

    it("Reg E assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x0000;
        cpu.e = 0x122f;

        expect(cpu.e).toEqual(0x2f);
    });

    it("Reg DE assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x1c3d;

        expect(cpu.d).toEqual(0x1c);
        expect(cpu.e).toEqual(0x3d);
        expect(cpu.de).toEqual(0x1c3d);
    });

    it("Reg DE assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.de = 0x1223ea;

        expect(cpu.de).toEqual(0x23ea);
    });

    it("Reg H assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x1c3d;
        cpu.h = 0x2f;

        expect(cpu.h).toEqual(0x2f);
        expect(cpu.l).toEqual(0x3d);
        expect(cpu.hl).toEqual(0x2f3d);
    });

    it("Reg H assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x0000;
        cpu.h = 0x122f;

        expect(cpu.h).toEqual(0x2f);
    });

    it("Reg L assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x1c3d;
        cpu.l = 0x2f;

        expect(cpu.h).toEqual(0x1c);
        expect(cpu.l).toEqual(0x2f);
        expect(cpu.hl).toEqual(0x1c2f);
    });

    it("Reg L assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x0000;
        cpu.l = 0x122f;

        expect(cpu.l).toEqual(0x2f);
    });

    it("Reg HL assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x1c3d;

        expect(cpu.h).toEqual(0x1c);
        expect(cpu.l).toEqual(0x3d);
        expect(cpu.hl).toEqual(0x1c3d);
    });

    it("Reg HL assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl = 0x1223ea;

        expect(cpu.hl).toEqual(0x23ea);
    });

    it("Reg AF' assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.af_ = 0x1c3d;

        expect(cpu.af_).toEqual(0x1c3d);
    });

    it("Reg AF' assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.af_ = 0x2b1c3d;

        expect(cpu.af_).toEqual(0x1c3d);
    });

    it("Reg BC' assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc_ = 0x1c3d;

        expect(cpu.bc_).toEqual(0x1c3d);
    });

    it("Reg BC' assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.bc_ = 0x2b1c3d;

        expect(cpu.bc_).toEqual(0x1c3d);
    });

    it("Reg DE' assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.de_ = 0x1c3d;

        expect(cpu.de_).toEqual(0x1c3d);
    });

    it("Reg DE' assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.de_ = 0x2b1c3d;

        expect(cpu.de_).toEqual(0x1c3d);
    });

    it("Reg HL' assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl_ = 0x1c3d;

        expect(cpu.hl_).toEqual(0x1c3d);
    });

    it("Reg HL' assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.hl_ = 0x2b1c3d;

        expect(cpu.hl_).toEqual(0x1c3d);
    });

    it("Reg XH assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x1c3d;
        cpu.xh = 0x2f;

        expect(cpu.xh).toEqual(0x2f);
        expect(cpu.xl).toEqual(0x3d);
        expect(cpu.ix).toEqual(0x2f3d);
    });

    it("Reg XH assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x0000;
        cpu.xh = 0x122f;

        expect(cpu.xh).toEqual(0x2f);
    });

    it("Reg XL assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x1c3d;
        cpu.xl = 0x2f;

        expect(cpu.xh).toEqual(0x1c);
        expect(cpu.xl).toEqual(0x2f);
        expect(cpu.ix).toEqual(0x1c2f);
    });

    it("Reg XL assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x0000;
        cpu.xl = 0x122f;

        expect(cpu.xl).toEqual(0x2f);
    });

    it("Reg IX assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x1c3d;

        expect(cpu.xh).toEqual(0x1c);
        expect(cpu.xl).toEqual(0x3d);
        expect(cpu.ix).toEqual(0x1c3d);
    });

    it("Reg IX assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ix = 0x1223ea;

        expect(cpu.ix).toEqual(0x23ea);
    });

    it("Reg YH assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x1c3d;
        cpu.yh = 0x2f;

        expect(cpu.yh).toEqual(0x2f);
        expect(cpu.yl).toEqual(0x3d);
        expect(cpu.iy).toEqual(0x2f3d);
    });

    it("Reg YH assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x0000;
        cpu.yh = 0x122f;

        expect(cpu.yh).toEqual(0x2f);
    });

    it("Reg YL assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x1c3d;
        cpu.yl = 0x2f;

        expect(cpu.yh).toEqual(0x1c);
        expect(cpu.yl).toEqual(0x2f);
        expect(cpu.iy).toEqual(0x1c2f);
    });

    it("Reg YL assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x0000;
        cpu.yl = 0x122f;

        expect(cpu.yl).toEqual(0x2f);
    });

    it("Reg IY assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x1c3d;

        expect(cpu.yh).toEqual(0x1c);
        expect(cpu.yl).toEqual(0x3d);
        expect(cpu.iy).toEqual(0x1c3d);
    });

    it("Reg IY assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.iy = 0x1223ea;

        expect(cpu.iy).toEqual(0x23ea);
    });

    it("Reg I assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x1c3d;
        cpu.i = 0x2f;

        expect(cpu.i).toEqual(0x2f);
        expect(cpu.r).toEqual(0x3d);
        expect(cpu.ir).toEqual(0x2f3d);
    });

    it("Reg I assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x0000;
        cpu.i = 0x122f;

        expect(cpu.i).toEqual(0x2f);
    });

    it("Reg R assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x1c3d;
        cpu.r = 0x2f;

        expect(cpu.i).toEqual(0x1c);
        expect(cpu.r).toEqual(0x2f);
        expect(cpu.ir).toEqual(0x1c2f);
    });

    it("Reg R assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x0000;
        cpu.r = 0x122f;

        expect(cpu.r).toEqual(0x2f);
    });

    it("Reg IR assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x1c3d;

        expect(cpu.i).toEqual(0x1c);
        expect(cpu.r).toEqual(0x3d);
        expect(cpu.ir).toEqual(0x1c3d);
    });

    it("Reg IR assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.ir = 0x1223ea;

        expect(cpu.ir).toEqual(0x23ea);
    });

    it("Reg PC assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.pc = 0x1c3d;

        expect(cpu.pc).toEqual(0x1c3d);
    });

    it("Reg PC assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.pc = 0x1223ea;

        expect(cpu.pc).toEqual(0x23ea);
    });

    it("Reg SP assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.sp = 0x1c3d;

        expect(cpu.sp).toEqual(0x1c3d);
    });

    it("Reg SP assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.sp = 0x1223ea;

        expect(cpu.sp).toEqual(0x23ea);
    });

    it("Reg WH assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x1c3d;
        cpu.wh = 0x2f;

        expect(cpu.wh).toEqual(0x2f);
        expect(cpu.wl).toEqual(0x3d);
        expect(cpu.wz).toEqual(0x2f3d);
    });

    it("Reg WH assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x0000;
        cpu.wh = 0x122f;

        expect(cpu.wh).toEqual(0x2f);
    });

    it("Reg WL assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x1c3d;
        cpu.wl = 0x2f;

        expect(cpu.wh).toEqual(0x1c);
        expect(cpu.wl).toEqual(0x2f);
        expect(cpu.wz).toEqual(0x1c2f);
    });

    it("Reg WL assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x0000;
        cpu.wl = 0x122f;

        expect(cpu.wl).toEqual(0x2f);
    });

    it("Reg WZ assignment", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x1c3d;

        expect(cpu.wh).toEqual(0x1c);
        expect(cpu.wl).toEqual(0x3d);
        expect(cpu.wz).toEqual(0x1c3d);
    });

    it("Reg WZ assignment is safe", ()=> {
        const cpu = new Z80Cpu();
        cpu.wz = 0x1223ea;

        expect(cpu.wz).toEqual(0x23ea);
    });
});