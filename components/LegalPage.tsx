import { ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalPageProps = {
  title: string;
  effectiveDate: string;
  introduction: ReactNode;
  sections: LegalSection[];
};

export default function LegalPage({
  title,
  effectiveDate,
  introduction,
  sections,
}: LegalPageProps) {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          Platform.OS === "web" ? styles.contentWeb : null,
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.brand}>POLYOPEN</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.date}>Effective: {effectiveDate}</Text>
          <View style={styles.introduction}>{introduction}</View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.body}>
                {paragraph}
              </Text>
            ))}

            {section.bullets?.map((bullet, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          PolyOpen · Ethical Love~Open Spirituality
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff8fc",
  },
  content: {
    padding: 18,
    paddingBottom: 80,
  },
  contentWeb: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  backButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#f0c9dd",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 18,
  },
  backText: {
    color: "#222222",
    fontSize: 15,
    fontWeight: "700",
  },
  hero: {
    borderWidth: 1,
    borderColor: "#f0c9dd",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 24,
    marginBottom: 16,
  },
  brand: {
    color: "#ec4aa8",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    color: "#1d1d1f",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 8,
  },
  date: {
    color: "#756b72",
    fontSize: 14,
    marginBottom: 18,
  },
  introduction: {
    gap: 12,
  },
  section: {
    borderWidth: 1,
    borderColor: "#f0c9dd",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 22,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#1d1d1f",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },
  body: {
    color: "#4a4147",
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },
  bullet: {
    color: "#ec4aa8",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    color: "#4a4147",
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    color: "#756b72",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
});
