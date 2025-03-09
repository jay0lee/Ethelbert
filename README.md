# Ethelbert
## An experimental ChromeOS extension implementing the ACME protocol for hardware-backed client certificates.

"Ethelbert" is the middle name of Wile E. Coyote who loved using ACME products but wasn't very good at it.

<img src="https://m.media-amazon.com/images/I/41I87vso8mL.jpg" alt="Wile E Coyote riding an ACME brand rocket"/>

Ethelbert was originally forked from the excellent [ACME HTML Web Browser Client](https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client) a single HTML/javascript file that implements the entirety of the ACME protocol.
- Adapted to act as a Chrome extension (HTML and javascript must be separated)
- Adapted to call [Chrome's enterprise.platformKeys API](https://developer.chrome.com/docs/extensions/reference/api/enterprise/platformKeys#type-Scope) to use hardware-backed certificates and private keys.
- Switched to using the `device-attestation-01` ACME challenge which is more appropriate for client devices.
- hacked the UI to reduce steps needed for a managed, device-based ACME certificate flow.
