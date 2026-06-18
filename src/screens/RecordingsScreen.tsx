import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import { formatBytes, formatDate, formatDuration } from '../utils/format';
import TabBar from '../components/TabBar';
import { CallRecord } from '../types';

type FilterType = 'ALL' | 'INCOMING' | 'OUTGOING' | 'MISSED';
type SortType = 'date_desc' | 'date_asc' | 'duration_desc' | 'size_desc';

export default function RecordingsScreen({ navigation }: any) {
  const { filteredRecords, searchQuery, updateSearchQuery, loadRecords, isLoading } =
    useCallStore();

  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [activeSort, setActiveSort] = useState<SortType>('date_desc');
  const [showSortOptions, setShowSortOptions] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  // Filter records
  const getFilteredData = (): CallRecord[] => {
    let data = [...filteredRecords];

    if (activeFilter !== 'ALL') {
      data = data.filter((r) => r.callType === activeFilter);
    }

    // Sort records
    data.sort((a, b) => {
      switch (activeSort) {
        case 'date_desc':
          return b.startTime - a.startTime;
        case 'date_asc':
          return a.startTime - b.startTime;
        case 'duration_desc':
          return b.duration - a.duration;
        case 'size_desc':
          return b.fileSize - a.fileSize;
        default:
          return b.startTime - a.startTime;
      }
    });

    return data;
  };

  const currentRecords = getFilteredData();

  const renderSortOption = (type: SortType, label: string) => {
    const isSelected = activeSort === type;
    return (
      <TouchableOpacity
        style={[styles.sortOption, isSelected && styles.sortOptionSelected]}
        onPress={() => {
          setActiveSort(type);
          setShowSortOptions(false);
        }}
      >
        <Text style={[styles.sortOptionText, isSelected && styles.sortOptionTextSelected]}>
          {label} {isSelected ? '✓' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: CallRecord }) => {
    const isMissed = item.callType === 'MISSED';

    return (
      <TouchableOpacity
        style={styles.recordItem}
        onPress={() => navigation.navigate('AudioPlayer', { record: item })}
        activeOpacity={0.7}
      >
        <View style={styles.recordMain}>
          <Text style={styles.recordIcon}>
            {item.callType === 'INCOMING' ? '📥' : item.callType === 'OUTGOING' ? '📤' : '❌'}
          </Text>
          <View style={styles.recordDetails}>
            <Text style={styles.recordPhone}>{item.phoneNumber}</Text>
            <Text style={styles.recordMeta}>{formatDate(item.startTime)}</Text>
          </View>
        </View>

        <View style={styles.recordRight}>
          {isMissed ? (
            <Text style={styles.missedLabel}>MISSED</Text>
          ) : (
            <>
              <Text style={styles.recordDuration}>{formatDuration(item.duration)}</Text>
              <Text style={styles.recordSize}>{formatBytes(item.fileSize)}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Audio Vault</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by phone number..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={updateSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity style={styles.clearSearch} onPress={() => updateSearchQuery('')}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter and Sort bar */}
      <View style={styles.actionsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {(['ALL', 'INCOMING', 'OUTGOING', 'MISSED'] as FilterType[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === filter && styles.filterPillTextActive,
                ]}
              >
                {filter === 'ALL' ? 'All calls' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortOptions(!showSortOptions)}
        >
          <Text style={styles.sortButtonText}>Sort ⚡</Text>
        </TouchableOpacity>
      </View>

      {/* Sort Options Overlay */}
      {showSortOptions && (
        <View style={styles.sortOverlay}>
          {renderSortOption('date_desc', 'Date (Newest first)')}
          {renderSortOption('date_asc', 'Date (Oldest first)')}
          {renderSortOption('duration_desc', 'Duration (Longest)')}
          {renderSortOption('size_desc', 'File Size (Largest)')}
        </View>
      )}

      {/* Recordings List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      ) : (
        <FlatList
          data={currentRecords}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recordings found</Text>
              <Text style={styles.emptySubText}>
                Try adjusting your filters or search query terms.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Bottom Tab */}
      <TabBar currentRoute="Recordings" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#F8FAFC',
    fontSize: 14,
  },
  clearSearch: {
    padding: 6,
  },
  clearSearchText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersScroll: {
    flexGrow: 0,
    marginRight: 12,
  },
  filterPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
  },
  filterPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  sortButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  sortOverlay: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 8,
  },
  sortOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  sortOptionText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  sortOptionTextSelected: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110, // space for floating bar
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  recordMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  recordIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  recordDetails: {
    flex: 1,
  },
  recordPhone: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordMeta: {
    color: '#64748B',
    fontSize: 11,
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordDuration: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordSize: {
    color: '#94A3B8',
    fontSize: 11,
  },
  missedLabel: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
