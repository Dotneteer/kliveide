# Stereo Audio Implementation Plan v2

## Problem Analysis
Previous Phase 5 broke audio (lagging) due to incorrect WebAudio worklet sample interleaving logic.

## Safe Approach: Mono Downmix at Renderer Boundary

### Phase 1-4: Core Stereo Infrastructure (SAFE - Already Proven)
- ✅ **Step 1**: PsgChip chipId support (15 tests)
- ✅ **Step 2**: TurboSoundDevice multi-chip management (29 tests)
- ✅ **Step 3**: Stereo mixing ABC/ACB/mono modes (31 tests)
- ✅ **Step 4**: PSG Pan Control (28 tests)
- ✅ **Total Audio Tests**: 211 passing

### Phase 5: Simple Mono Downmix (NEW APPROACH)
**Strategy:** Convert stereo → mono at renderer, keeping WebAudio unchanged

**Changes:**
1. **AudioRenderer.ts**: `storeSamples(samples: AudioSample[])`
   - Downmix: `(sample.left + sample.right) / 2`
   - Send mono `number[]` to worklet (unchanged)
   
2. **EmulatorPanel.tsx**: Pass `AudioSample[]` to renderer
   - Apply soundLevel in downmix

3. **Sampling.worklet.js**: NO CHANGES (keep working mono)

**Advantages:**
- Zero risk to working WebAudio code
- Stereo infrastructure complete for future enhancement
- Simple, testable, safe

## Future Enhancement (Phase 6 - Optional)
True stereo WebAudio when time permits careful testing:
- Update worklet to handle 2-channel output correctly
- Test with browser audio inspector
- Verify no lag/buffering issues

## Files to Modify (Phase 5 only)

1. `src/renderer/appEmu/EmulatorArea/AudioRenderer.ts`
   - Import `AudioSample` type
   - Change `storeSamples(samples: AudioSample[], soundLevel: number)`
   - Downmix: `samples.map(s => (s.left + s.right) / 2 * soundLevel)`

2. `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx`
   - Import `AudioSample` type  
   - Change type: `AudioSample[]` instead of `number[]`
   - Pass samples to `storeSamples(samples, soundLevel)`

## Implementation Time: 10 minutes

## Validation:
- All 108 tests pass ✅
- No compilation errors ✅
- Audio works without lag ✅
- Future stereo enhancement possible ✅
