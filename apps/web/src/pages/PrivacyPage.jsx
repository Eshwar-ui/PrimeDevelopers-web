import { Link } from 'react-router-dom'
import { useSection } from '../context/ContentContext'
import LegalPage, { Clause, ClauseList } from '../components/LegalPage'

/**
 * NOT LEGAL ADVICE, AND NOT YET REVIEWED BY COUNSEL.
 *
 * This is an accurate description of what this site actually does with a
 * visitor's data — the contact form and the brochure request are the only two
 * collection points, and both are described below. It is written to be true
 * rather than to be exhaustive
 * boilerplate, which makes it a sound starting point and not a substitute for
 * a review by whoever advises Prime Developers.
 *
 * Two things to check before this is treated as final:
 *   1. `footer.legalName` and the `footer.address*` parts are blank in the
 *      CMS, so the opening clause names the trading name only.
 *   2. The rights clause assumes Texas (TDPSA). If the business processes data
 *      for residents of states with their own statutes, that clause grows.
 */

const HEADINGS = [
  'Who we are',
  'What we collect',
  'Why we collect it',
  'Cookies and analytics',
  'Who we share it with',
  'How long we keep it',
  'How we protect it',
  'Your rights',
  'Children and this site',
  'Changes to this policy',
  'Contact us',
]

export default function PrivacyPage() {
  const { email, phone, studio, legalName } = useSection('footer')
  const entity = legalName || 'Prime Developers'
  const telHref = phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : null

  return (
    <LegalPage
      title="Privacy Policy"
      summary="What we collect when you use this site, why we collect it, and what you can ask us to do with it."
      updated="5 September 2026"
      headings={HEADINGS}
    >
      <Clause title="Who we are">
        <p>
          {entity} is a real estate developer operating in Texas. This policy covers this website
          and the enquiry forms on it. It does not cover anything you sign with us later — a
          purchase agreement or a lease carries its own terms.
        </p>
        {studio ? <p>You can reach us at {studio}.</p> : null}
      </Clause>

      <Clause title="What we collect">
        <p>There are two places on this site where you can give us information, and no others:</p>
        <ClauseList
          items={[
            'Enquiry forms. Your name, your email address, your phone number if you give one, and whatever you write in the message. If you started from a particular property or unit, we record which one, so we know what you are asking about.',
            'Brochure requests. Your name and email address, so we can send the brochure you asked for.',
          ]}
        />
        <p>
          We also receive the ordinary technical information any web server receives — IP address,
          browser type, which pages were requested and when. Our host uses it to serve the site and
          to rate-limit abuse of the forms.
        </p>
        <p>
          We do not ask for, and you should not send us, financial account numbers, government
          identification numbers, or information about health, religion or ethnicity. If such
          information ends up in a message field anyway, we handle it under this policy and delete
          it once it is no longer needed.
        </p>
      </Clause>

      <Clause title="Why we collect it">
        <ClauseList
          items={[
            'To answer you. An enquiry is a question, and the details you send are what let us answer it.',
            'To send you what you asked for — a brochure, or an answer to your question.',
            'To keep a record of who we have spoken to about which property. That is ordinary business record-keeping, and in some cases a regulatory requirement.',
            'To keep the site running and to stop automated abuse of the forms.',
          ]}
        />
        <p>
          We do not sell your personal data, we do not share it with advertisers, and we do not use
          it to build a profile of you for targeted advertising.
        </p>
      </Clause>

      <Clause title="Cookies and analytics">
        <p>
          This site stores one thing in your browser: whether you prefer the light or the dark
          theme, under the key{' '}
          <code className="rounded bg-surface-alt px-1.5 py-0.5 text-[14px]">prime-theme</code>. It
          never leaves your device, and it is a preference rather than an identifier.
        </p>
        <p>
          If we add analytics later, this section will name the provider, say what it measures and
          explain how to opt out — before it is switched on, not after.
        </p>
      </Clause>

      <Clause title="Who we share it with">
        <p>
          Only with the service providers that make the site work, and only so far as they need it
          to do their job: our hosting and database provider, and the service that delivers our
          email. They act on our instructions and may not use your information for their own
          purposes.
        </p>
        <p>
          We will also disclose information where the law requires it, or where we need to establish
          or defend a legal claim. If the business is sold or merged, enquiry records may transfer
          with it — you would be told before that changed anything about how your data is handled.
        </p>
      </Clause>

      <Clause title="How long we keep it">
        <p>
          Enquiries are kept while the conversation is live and for a reasonable period afterwards,
          so we can pick up where we left off and so there is a record of what was discussed.
          Server logs are kept for a short operational period only.
        </p>
      </Clause>

      <Clause title="How we protect it">
        <p>
          The site is served over HTTPS, and enquiries are written to our database through an
          authenticated API — the browser holds no database credentials of its own. Access to the
          admin that reads those records is restricted to named accounts.
        </p>
        <p>
          No system is perfect and we will not claim otherwise. If a breach affects your
          information, we will tell you and the relevant authority as the law requires.
        </p>
      </Clause>

      <Clause title="Your rights">
        <p>
          Under the Texas Data Privacy and Security Act, and comparable laws elsewhere, you can ask
          us to:
        </p>
        <ClauseList
          items={[
            'Confirm whether we hold personal data about you, and give you a copy of it.',
            'Correct anything inaccurate.',
            'Delete what we hold.',
            'Stop using it for targeted advertising, sale, or profiling — none of which we do.',
          ]}
        />
        <p>
          Write to us and we will respond within the period the law allows. We may need to verify
          who you are first, which will not take more information than the request itself does.
          There is no charge, and if we refuse a request we will say why and how to appeal it.
        </p>
      </Clause>

      <Clause title="Children and this site">
        <p>
          This site is meant for adults doing business with us. We do not knowingly collect
          information from anyone under 13. If you believe a child has sent us something, contact us
          and we will delete it.
        </p>
      </Clause>

      <Clause title="Changes to this policy">
        <p>
          When this policy changes, the date at the top of the page changes with it. Material
          changes will be flagged on the site rather than made quietly.
        </p>
      </Clause>

      <Clause title="Contact us">
        <p>
          {email ? (
            <>
              Email{' '}
              <a className="text-accent underline underline-offset-4" href={`mailto:${email}`}>
                {email}
              </a>
              {telHref ? ', or call ' : '.'}
            </>
          ) : null}
          {telHref ? (
            <>
              <a className="text-accent underline underline-offset-4" href={telHref}>
                {phone}
              </a>
              .
            </>
          ) : null}
        </p>
        <p>
          Our{' '}
          <Link className="text-accent underline underline-offset-4" to="/terms">
            Terms of Use
          </Link>{' '}
          govern your use of this site.
        </p>
      </Clause>
    </LegalPage>
  )
}
