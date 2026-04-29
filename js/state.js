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
    timeEntries: {}
  },

  activeColumnFilterInput: null,
  tableScrollLeft: 0,

  routeBuilder: {
    calendarName: "",
    date: "",
    stops: [],
    mapsUrl: "",
    copyMessage: "",

    travelLogWorkerName: "",
    travelLogWorkerId: "",
    travelLogWorkerRole: "",
    travelLogHourlyRate: "",
    travelLogMileageRate: "0.70",
    travelLogText: ""
  }
};