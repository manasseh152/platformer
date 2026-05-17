# Key speedrun records by tilemap during one-to-one scenario phase

Speed Run Mode records player-facing best times, which conceptually belong to the timed scenario identity. Today shipped timed scenarios are one-to-one with tilemaps, so records are keyed by `tilemap.id` to avoid splitting best times when lightweight scenario wrappers launch the same tilemap; if scenarios later add meaningful modifiers for the same tilemap, record identity should be revisited before shipping those modifiers.
