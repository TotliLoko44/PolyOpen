import { Text } from "react-native";
import LegalPage, { LegalSection } from "../components/LegalPage";

const EFFECTIVE_DATE = "September 24, 2026";
const CONTACT_EMAIL = "totliloko@proton.me";

const sections: LegalSection[] = [
  {
    title: "1. Eligibility and acceptance",
    paragraphs: [
      "You must be at least 18 years old and legally able to enter into these Terms to use PolyOpen. By creating an account, accessing the service, or purchasing a product, you agree to these Terms and the Privacy Policy.",
      "PolyOpen is intended for adults interested in ethical non-monogamy, polyamory, dating, social connection, spirituality, live interaction, and related community features.",
    ],
  },
  {
    title: "2. Accounts",
    paragraphs: [
      "You must provide accurate account information, protect your login credentials, and promptly update information that changes. You are responsible for activity performed through your account unless you report unauthorized access.",
      "You may not impersonate another person, create deceptive accounts, sell accounts, or use another member's account without permission.",
    ],
  },
  {
    title: "3. Consent, safety, and community conduct",
    paragraphs: [
      "PolyOpen is built around informed consent, honesty, respect, and personal boundaries. Using PolyOpen never creates consent to sexual activity, communication, recording, sharing, or an in-person meeting.",
    ],
    bullets: [
      "Respect every member's boundaries and right to stop communicating.",
      "Do not harass, threaten, stalk, exploit, coerce, discriminate against, or deceive others.",
      "Do not share another person's private information or intimate material without explicit permission.",
      "Use caution when meeting someone and never send money or financial credentials to another member.",
      "Report suspected abuse, fraud, exploitation, or dangerous behavior.",
    ],
  },
  {
    title: "4. Prohibited content and activity",
    paragraphs: [
      "You may not use PolyOpen for illegal, harmful, fraudulent, abusive, or exploitative activity.",
    ],
    bullets: [
      "Content involving minors or anyone presented as a minor.",
      "Non-consensual sexual content, trafficking, exploitation, or sexual coercion.",
      "Threats, targeted harassment, hate, doxxing, fraud, spam, malware, or scams.",
      "Unauthorized commercial solicitation or attempts to manipulate platform systems.",
      "Recording live calls, Speed Dates, or private communications without all required consent.",
      "Attempts to bypass access controls, interfere with the service, or access another person's data.",
    ],
  },
  {
    title: "5. Member content",
    paragraphs: [
      "You retain ownership of content you submit. You grant PolyOpen a non-exclusive, worldwide, royalty-free license to host, store, reproduce, format, display, and distribute that content only as needed to operate, secure, improve, and promote the service according to your selected visibility settings.",
      "You represent that you have the rights and permissions needed to post your content. You may remove content using available controls, although backup, safety, legal, and transaction records may remain for a limited period.",
    ],
  },
  {
    title: "6. Messaging, live rooms, and Speed Dating",
    paragraphs: [
      "PolyOpen provides messaging, live rooms, and live Speed Dating features. Camera and microphone access is used to transmit live audio and video when you choose to participate.",
      "PolyOpen does not use facial recognition, expression analysis, voice analysis, movement tracking, or behavioral surveillance to evaluate members. Live communication may depend on third-party transmission infrastructure.",
    ],
  },
  {
    title: "7. Paid plans, billing, and renewal",
    paragraphs: [
      "Paid subscriptions may include Premium features, removal of advertisements, Gold Verification access, weekly boosts, or bundled benefits described at checkout. Prices and included benefits are shown before purchase.",
      "Subscriptions automatically renew at the disclosed interval until canceled. RevenueCat manages subscription access and Stripe processes web payments. PolyOpen does not receive your complete payment-card number.",
      "You may cancel through the available subscription-management portal. Cancellation stops future renewal and normally leaves access active through the paid period. Refunds are handled according to the checkout terms, applicable law, and the payment provider's rules.",
    ],
  },
  {
    title: "8. VIP access",
    paragraphs: [
      "VIP is a discretionary, administrator-granted membership. VIP may include current and future paid PolyOpen benefits without a separate subscription charge.",
      "VIP status is personal, non-transferable, has no cash value, and may be revoked for misuse, account transfer, fraud, safety violations, or loss of eligibility.",
    ],
  },
  {
    title: "9. Verification",
    paragraphs: [
      "A verification badge indicates that PolyOpen completed the verification process available at that time. It is not a guarantee of identity, intentions, character, safety, compatibility, or truthfulness.",
    ],
  },
  {
    title: "10. Advertisements and third-party services",
    paragraphs: [
      "Free access may include advertisements. PolyOpen also relies on service providers for hosting, authentication, live communication, notifications, billing, payment processing, and advertising.",
      "Third-party services may have separate terms and privacy practices. PolyOpen is not responsible for third-party websites or services outside its control.",
    ],
  },
  {
    title: "11. Moderation and enforcement",
    paragraphs: [
      "PolyOpen may investigate reports and remove content, restrict features, suspend accounts, revoke benefits, or terminate access when reasonably necessary to enforce these Terms, protect members, comply with law, prevent fraud, or secure the service.",
      "PolyOpen is not obligated to monitor every interaction and cannot guarantee that every member or item of content complies with these Terms.",
    ],
  },
  {
    title: "12. Intellectual property",
    paragraphs: [
      "PolyOpen's name, logo, software, interface, designs, and original content are protected by intellectual-property laws. These Terms do not transfer ownership of PolyOpen property to you.",
    ],
  },
  {
    title: "13. Disclaimers",
    paragraphs: [
      "PolyOpen is provided on an as-is and as-available basis to the fullest extent permitted by law. PolyOpen does not guarantee uninterrupted operation, successful relationships, member conduct, compatibility, identity, earnings, audience size, or any specific result.",
      "PolyOpen is not a substitute for emergency services, professional medical care, mental-health care, legal advice, or financial advice.",
    ],
  },
  {
    title: "14. Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, PolyOpen and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, loss of data, loss of profits, personal disputes, or harm caused by another member or third party.",
      "Nothing in these Terms excludes rights or liabilities that cannot legally be excluded.",
    ],
  },
  {
    title: "15. Changes and governing law",
    paragraphs: [
      "PolyOpen may update these Terms as features, laws, or business practices change. Material updates will be communicated through reasonable means, and the effective date will be revised.",
      "These Terms are governed by the laws of California, without regard to conflict-of-law principles, except where mandatory consumer law provides otherwise.",
    ],
  },
  {
    title: "16. Contact",
    paragraphs: [
      `Questions about these Terms may be sent to ${CONTACT_EMAIL}.`,
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Use"
      effectiveDate={EFFECTIVE_DATE}
      introduction={
        <>
          <Text>These Terms govern your access to and use of PolyOpen.</Text>
          <Text>Please read them carefully before using the service.</Text>
        </>
      }
      sections={sections}
    />
  );
}
