; Never writes the ready marker.
    .model Next
    .savenex file "no-ready.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
    .ent $
    di
    jr $
