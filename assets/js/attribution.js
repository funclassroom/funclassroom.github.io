/* Where did this visit come from?
   A link you post should carry ?ref=<channel> (or utm_source). This reads it,
   keeps it for the rest of the tab, and hands it to PostHog as a super
   property called "channel", so every event in the session is credited to it.
   A visit that starts on the wall and moves on to files.html stays on the same
   channel.

   PostHog may not have finished loading when this runs, and it may not be
   installed at all. In that case the value is left on window.CLASSROOM_CHANNEL
   for the init config to pick up (loaded: (ph) => ph.register(...)). Nothing is
   sent from here and nothing is stored on a server. */
(function () {
  try {
    var KEY = "classroom.ref";
    var params = new URLSearchParams(window.location.search || "");
    var source = params.get("ref") || params.get("utm_source") || "";
    source = source.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);

    if (!source) {
      try { source = window.sessionStorage.getItem(KEY) || ""; } catch (err) { source = ""; }
    } else {
      try { window.sessionStorage.setItem(KEY, source); } catch (err) {}
    }

    if (!source) return;

    if (window.posthog && typeof window.posthog.register === "function") {
      window.posthog.register({ channel: source });
    } else {
      window.CLASSROOM_CHANNEL = source;
    }
  } catch (err) {}
}());
