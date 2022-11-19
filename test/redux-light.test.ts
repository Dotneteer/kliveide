import "mocha";
import { expect } from "expect";
import createAppStore from "../common/state/store";
import { emuShowToolbarAction, uiLoadedAction } from "../common/state/actions";
import { Action } from "../common/state/Action";

describe("AppState management", () => {
    it("Initial AppState after createAppStore", ()=> {
        const store = createAppStore();

        const state = store.getState();
        expect(state.uiLoaded).toBe(false);
        expect(state.emuViewOptions.showToolbar).toBe(true);
    });

    it("AppFlags reducer works", ()=> {
        const store = createAppStore();

        store.dispatch(uiLoadedAction(true));

        const state = store.getState();
        expect(state.uiLoaded).toBe(true);
    })

    it("AppFlags reducer with subscribe works", ()=> {
        const store = createAppStore();

        let counter = 0;
        const unsubscribe = store.subscribe(() => {
            counter++;
        })
        store.dispatch(uiLoadedAction(true));
        unsubscribe();

        const state = store.getState();
        expect(state.uiLoaded).toBe(true);
        expect(counter).toBe(1);
    });

    it("EmuViewOptions reducer works", ()=> {
        const store = createAppStore();

        store.dispatch(emuShowToolbarAction(false));

        const state = store.getState();
        expect(state.emuViewOptions.showToolbar).toBe(false);
    });

    it("EmuViewOptions reducer with subscribe works", ()=> {
        const store = createAppStore();

        let counter = 0;
        const unsubscribe = store.subscribe(() => {
            counter++;
        })
        store.dispatch(emuShowToolbarAction(false));
        unsubscribe();

        const state = store.getState();
        expect(state.emuViewOptions.showToolbar).toBe(false);
        expect(counter).toBe(1);
    });

    it("Combined reducers works", ()=> {
        const store = createAppStore();

        store.dispatch(uiLoadedAction(true));
        store.dispatch(emuShowToolbarAction(false));

        const state = store.getState();
        expect(state.uiLoaded).toBe(true);
        expect(state.emuViewOptions.showToolbar).toBe(false);
    });

    it("Combined reducers with subscribe work", ()=> {
        const store = createAppStore();

        let counter = 0;
        const unsubscribe = store.subscribe(() => {
            counter++;
        })
        store.dispatch(uiLoadedAction(true));
        store.dispatch(emuShowToolbarAction(false));
        unsubscribe();

        const state = store.getState();
        expect(state.uiLoaded).toBe(true);
        expect(state.emuViewOptions.showToolbar).toBe(false);
        expect(counter).toBe(2);
    });

    it("Combined reducers with forwarding work", ()=> {
        let forwarded = 0;
        const store = createAppStore(async (action: Action) => {
            forwarded++;
        });

        let counter = 0;
        const unsubscribe = store.subscribe(() => {
            counter++;
        })
        store.dispatch(uiLoadedAction(true));
        store.dispatch(emuShowToolbarAction(false));
        unsubscribe();

        const state = store.getState();
        expect(state.uiLoaded).toBe(true);
        expect(state.emuViewOptions.showToolbar).toBe(false);
        expect(counter).toBe(2);
        expect(forwarded).toBe(2);
    });
});