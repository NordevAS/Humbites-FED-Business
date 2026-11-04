const versions = [
  {
    id: 'ordering',
    label: 'Bestillingsopplevelse',
    description: 'Arrangement, matbestilling og eierdemo · krever tilgang',
    url: 'https://humbites-ordering-experience.matiaspilnyh.chatgpt.site',
  },
  {
    id: 'booking',
    label: 'Bookingdemo',
    description: 'Kunde- og eierflyt med lagrede demodata',
    url: 'https://humbites-booking-demo.matiaspilnyh.chatgpt.site',
  },
  {
    id: 'pulse',
    label: 'Pulse',
    description: 'Den uttrykksfulle, første kundedemoen',
    url: 'https://humbites-bold.matiaspilnyh.chatgpt.site',
  },
  {
    id: 'classic',
    label: 'Klassisk',
    description: 'Den opprinnelige kundedemoen',
    url: 'https://humbites-demo.matiaspilnyh.chatgpt.site',
  },
] as const;

/** Plain cross-site links preserve each version's own session and access policy. */
export function VersionNavigation({
  current,
}: {
  current: (typeof versions)[number]['id'];
}) {
  const selected = versions.find((version) => version.id === current)!;
  return (
    <nav className="hb-version-bar" aria-label="Humbites-versjoner">
      <div className="hb-version-inner">
        <a
          className="hb-version-home"
          href="https://humbites-master.matiaspilnyh.chatgpt.site"
        >
          <span aria-hidden="true">✳</span> Alle Humbites-versjoner
        </a>
        <details className="hb-version-switcher">
          <summary>Bytt versjon · {selected.label}</summary>
          <div className="hb-version-menu">
            {versions.map((version) => (
              <a
                key={version.id}
                href={version.url}
                aria-current={version.id === current ? 'page' : undefined}
              >
                <strong>
                  {version.label}
                  {version.id === current ? ' · Du er her' : ''}
                </strong>
                <span>{version.description}</span>
              </a>
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}
