/* Where did this visit come from?
   A link you post should carry ?ref=<channel> (or utm_source). This reads it,
   hands it to Clarity as a custom tag called "channel", and keeps it for the
   rest of the tab so a visit that starts on the wall and moves to files.html
   is still counted against that channel.
   Nothing is stored on a server and nothing is sent anywhere except the
   Clarity tag call that is already on the page. */
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

    if (!source || typeof window.clarity !== "function") return;
    window.clarity("set", "channel", source);
  } catch (err) {}
}());
