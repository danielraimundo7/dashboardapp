export const state = {
  currentTab: "events",
  currentView: "main",

  eventsData: [],
  workers: [],
  jobsPerWorker: [],
  timeEntries: [],

  selectedEvent: null,
  selectedWorker: null,
  selectedTimeEntry: null,

  eventsLoadedFromApi: false,
  workersLoadedFromApi: false,
  jobsPerWorkerLoadedFromApi: false,
  timeEntriesLoadedFromApi: false,

  dashboardMeta: { lastSyncIso: "" },

  revenueLaborChart: null,
  assignedTimeChart: null,

  selectedCalendars: new Set(),
  chartsMinimized: false,
  copyStatusMessage: "",

  eventDetailOpen: false,
  timeEntryMapOpen: false,

  columnFilters: {
    events: {},
    jobs: {},
    travel: {},
    workers: {},
    timeEntries: {},
    reports: {}
  },

  activeColumnFilterInput: null,
  tableScrollLeft: 0,

  routeBuilder: {
    calendarName: "",
    date: "",
    stops: [],
    mapsUrl: "",
    copyMessage: "",

    travelRouteMode: "Driver",
    selectedStopEventIds: [],

    travelLogWorkerSearch: "",
    travelLogWorkerName: "",
    travelLogWorkerId: "",
    travelLogWorkerRole: "",
    travelLogHourlyRate: "",
    travelLogMileageRate: "0.70",
    travelLogText: "",

    travelTotalMiles: "",
    travelTotalDriveMinutes: "",
    travelFreeMinutesPerLeg: 25,
    travelPayableMinutes: 0
  },

  reports: {
    weekStartDate: "",
    selectedWorkerId: "",
    generatedReports: [],
    message: ""
  },

  finance: {
  filters: {}
}
};