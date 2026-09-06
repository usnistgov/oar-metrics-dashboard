import { Component } from '@angular/core';

interface FooterLink {
  title: string;
  url: string;
}

/**
 * Site footer that mirrors the NIST agency footer used across OAR (social icons, NIST wordmark,
 * policy/agency links, CoreTrustSeal). Always dark, independent of the app theme, matching the
 * standard NIST footer. Social icons are inline SVG (no icon-font dependency).
 */
@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  readonly links: FooterLink[] = [
    { title: 'Site Privacy', url: 'https://www.nist.gov/privacy-policy' },
    { title: 'Accessibility', url: 'https://www.nist.gov/oism/accessibility' },
    { title: 'Privacy Program', url: 'https://www.nist.gov/privacy' },
    {
      title: 'Copyrights',
      url: 'https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications',
    },
    { title: 'Vulnerability Disclosure', url: 'https://www.commerce.gov/vulnerability-disclosure-policy' },
    { title: 'No Fear Act Policy', url: 'https://www.nist.gov/no-fear-act-policy' },
    { title: 'FOIA', url: 'https://www.nist.gov/foia' },
    { title: 'Environmental Policy', url: 'https://www.nist.gov/environmental-policy-statement' },
    { title: 'Scientific Integrity', url: 'https://www.nist.gov/summary-report-scientific-integrity' },
    { title: 'Information Quality Standards', url: 'https://www.nist.gov/nist-information-quality-standards' },
    { title: 'Commerce.gov', url: 'https://www.commerce.gov/' },
    { title: 'Science.gov', url: 'http://www.science.gov/' },
    { title: 'USA.gov', url: 'http://www.usa.gov/' },
  ];
}
