export const state = {
  currentTab: "events",
  currentView: "main",

  eventsData: [],
  workers: [],
  jobsPerWorker: [],

  selectedEvent: null,
  selectedWorker: null,

  eventsLoadedFromApi: false,
  workersLoadedFromApi: false,
  jobsPerWorkerLoadedFromApi: false,
  dashboardMeta: { lastSyncIso: "" },

  revenueLaborChart: null,
  assignedTimeChart: null,
  selectedCalendars: new Set(),
  chartsMinimized: false,
  copyStatusMessage: "",

  eventDetailOpen: false,

  columnFilters: {
    events: {},
    jobs: {},
    travel: {},
    workers: {}
  },

  activeColumnFilterInput: null,
  tableScrollLeft: 0,

  routeBuilder: {
    calendarName: "",
    date: "",
    stops: [],
    mapsUrl: "",
    copyMessage: ""
  }
};