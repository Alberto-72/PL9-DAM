return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#2563EB" />

      {/*Application header*/}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Control Guardia</Text>
        <Text style={styles.headerSubtitle}>IES San Juan de la Rambla</Text>
      </View>

      {/*Main content area*/}
      <View style={styles.content}>{renderContent()}</View>

      {/*Bottom navigation bar with 3 tabs*/}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => setTabActiva(0)} style={styles.tabItem}>
          <Ionicons name="radio" size={28} color={tabActiva === 0 ? "#2563EB" : "#9CA3AF"} style={{ transform: [{ rotate: '90deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(1)} style={styles.tabItem}>
          <Ionicons name="people" size={28} color={tabActiva === 1 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTabActiva(2)} style={styles.tabItem}>
          <Ionicons name="settings" size={28} color={tabActiva === 2 ? "#2563EB" : "#9CA3AF"} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );