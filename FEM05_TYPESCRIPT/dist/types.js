/**
 * Central type definitions for the Journal App.
 * Every other module imports its data contracts from here.
 */
export var Mood;
(function (Mood) {
    Mood["HAPPY"] = "HAPPY";
    Mood["SAD"] = "SAD";
    Mood["MOTIVATED"] = "MOTIVATED";
    Mood["STRESSED"] = "STRESSED";
    Mood["CALM"] = "CALM";
})(Mood || (Mood = {}));
export const MOOD_META = {
    [Mood.HAPPY]: { label: "Happy", emoji: "😊", className: "mood-happy" },
    [Mood.SAD]: { label: "Sad", emoji: "😔", className: "mood-sad" },
    [Mood.MOTIVATED]: { label: "Motivated", emoji: "🚀", className: "mood-motivated" },
    [Mood.STRESSED]: { label: "Stressed", emoji: "😣", className: "mood-stressed" },
    [Mood.CALM]: { label: "Calm", emoji: "🍃", className: "mood-calm" },
};
//# sourceMappingURL=types.js.map