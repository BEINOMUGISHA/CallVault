import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { AISummary } from '../types';

interface TranscriptViewerProps {
  transcript?: string;
  summary?: AISummary;
}

export default function TranscriptViewer({ transcript, summary }: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const renderSentimentBadge = () => {
    if (!summary?.sentiment) return null;
    const colors: Record<string, { bg: string; text: string }> = {
      calm: { bg: '#064E3B', text: '#34D399' },
      urgent: { bg: '#78350F', text: '#FBBF24' },
      agitated: { bg: '#7F1D1D', text: '#F87171' },
      suspicious: { bg: '#831843', text: '#F472B6' },
      neutral: { bg: '#1E293B', text: '#94A3B8' },
    };
    const c = colors[summary.sentiment] || colors.neutral;

    return (
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.text }]}>
          {summary.sentiment.toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Executive Summary Card */}
      {summary && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Executive AI Summary</Text>
            {renderSentimentBadge()}
          </View>
          <Text style={styles.overviewText}>{summary.overview}</Text>

          {/* Key Points */}
          {summary.keyPoints && summary.keyPoints.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Takeaways:</Text>
              {summary.keyPoints.map((point, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Items */}
          {summary.actionItems && summary.actionItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Action Items & Follow-ups:</Text>
              {summary.actionItems.map((item, i) => (
                <View key={i} style={styles.actionRow}>
                  <Text style={styles.actionCheck}>✓</Text>
                  <Text style={styles.actionText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Transcript Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Full Call Transcript</Text>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search spoken words in this call..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              {transcript}
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No transcript available for this call session.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  overviewText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    color: '#8B5CF6',
    fontSize: 16,
    lineHeight: 18,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  actionCheck: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  actionText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  transcriptBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
  },
  transcriptText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  emptyText: {
    color: '#64748B',
    fontStyle: 'italic',
    fontSize: 13,
  },
});
