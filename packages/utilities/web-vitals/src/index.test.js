import fetch from 'cross-fetch';
import * as webVitals from 'web-vitals';
import { renderHook } from '@testing-library/react-hooks';
import useWebVitals from './index';

jest.mock('cross-fetch');
jest.mock('web-vitals');

const mockVitalsGet = (name, value) => reportHandler => {
  reportHandler({ name, value });
};

webVitals.getCLS.mockImplementation(mockVitalsGet('CLS', 1));
webVitals.getFID.mockImplementation(mockVitalsGet('FID', 2));
webVitals.getLCP.mockImplementation(mockVitalsGet('LCP', 3));
webVitals.getFCP.mockImplementation(mockVitalsGet('FCP', 4));
webVitals.getTTFB.mockImplementation(mockVitalsGet('TTFB', 5));

let eventListeners = {};

const mockEventListener = mockedEvent => {
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  window.addEventListener = jest.fn((event, cb) => {
    if (event !== mockedEvent) {
      originalAddEventListener(event, cb);
    } else {
      eventListeners[event] = cb;
    }
  });
  window.removeEventListener = jest.fn((event, cb) => {
    if (event !== mockedEvent) {
      originalRemoveEventListener(event, cb);
    } else {
      delete eventListeners[event];
    }
  });
};

const mockSendBeacon = () => {
  navigator.sendBeacon = jest.fn();
};

describe('useWebVitals', () => {
  beforeEach(() => {
    mockEventListener('pagehide');
    Date.now = jest.fn().mockImplementation(() => 10000);
  });

  afterEach(() => {
    eventListeners = {};
    delete navigator.sendBeacon;
    jest.resetAllMocks();
    Date.now.mockRestore();
  });

  describe('when enabled is set to false', () => {
    const enabled = false;
    it('collects web vitals data, but does not send it', () => {
      mockSendBeacon();
      renderHook(() => useWebVitals({ enabled }));

      expect(webVitals.getCLS).toHaveBeenCalled();
      expect(webVitals.getFID).toHaveBeenCalled();
      expect(webVitals.getLCP).toHaveBeenCalled();
      expect(webVitals.getFCP).toHaveBeenCalled();
      expect(webVitals.getTTFB).toHaveBeenCalled();

      eventListeners.pagehide();

      expect(navigator.sendBeacon).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('when enabled is set to true', () => {
    const enabled = true;
    const reportingEndpoint = 'https://endpoint.to.report.to';
    it('sends a beacon via navigator.sendBeacon when enabled', async () => {
      mockSendBeacon();
      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      await eventListeners.pagehide();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        reportingEndpoint,
        expect.any(String),
      );
    });

    it('falls back to use fetch when sendBeacon is unavailable', async () => {
      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      await eventListeners.pagehide();

      expect(navigator.sendBeacon).toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/reports+json' },
        body: expect.any(String),
      });
    });

    it('appends the report params as query string parameters to the reporting endpoint if one is provided', async () => {
      mockSendBeacon();
      const reportParams = [
        { name: 'page_type', value: 'STY' },
        { name: 'technology_stack', value: 'simorgh' },
      ];
      renderHook(() =>
        useWebVitals({ enabled, reportingEndpoint, reportParams }),
      );

      await eventListeners.pagehide();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        `${reportingEndpoint}?page_type=STY&technology_stack=simorgh`,
        expect.any(String),
      );
    });

    it('does not override any existing query parameters on the reporting endpoint', async () => {
      mockSendBeacon();
      const reportingEndpointWithQuery = `${reportingEndpoint}?analytics=web-vitals`;
      const reportParams = [
        { name: 'page_type', value: 'STY' },
        { name: 'technology_stack', value: 'simorgh' },
      ];
      renderHook(() =>
        useWebVitals({
          enabled,
          reportingEndpoint: reportingEndpointWithQuery,
          reportParams,
        }),
      );

      await eventListeners.pagehide();

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        `${reportingEndpoint}?analytics=web-vitals&page_type=STY&technology_stack=simorgh`,
        expect.any(String),
      );
    });

    it('collects and sends web vitals data', async () => {
      mockSendBeacon();
      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      expect(webVitals.getCLS).toHaveBeenCalled();
      expect(webVitals.getFID).toHaveBeenCalled();
      expect(webVitals.getLCP).toHaveBeenCalled();
      expect(webVitals.getFCP).toHaveBeenCalled();
      expect(webVitals.getTTFB).toHaveBeenCalled();

      await eventListeners.pagehide();

      const expectedBeacon = [
        expect.objectContaining({
          type: 'web-vitals',
          body: expect.objectContaining({
            cls: 1,
            fid: 2,
            lcp: 3,
            fcp: 4,
            ttfb: 5,
          }),
        }),
      ];

      const sentBeacon = navigator.sendBeacon.mock.calls[0][1];

      expect(JSON.parse(sentBeacon)).toEqual(expectedBeacon);
    });

    it('collects and sends device capability data', async () => {
      mockSendBeacon();
      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      await eventListeners.pagehide();

      const expectedBeacon = [
        expect.objectContaining({
          type: 'web-vitals',
          body: expect.objectContaining({
            device_effective_connection: '4g',
            device_cpu: 4,
            device_mem: 3,
          }),
        }),
      ];

      const sentBeacon = navigator.sendBeacon.mock.calls[0][1];

      expect(JSON.parse(sentBeacon)).toEqual(expectedBeacon);
    });

    it('records the view age of the page at the time the beacon is sent', async () => {
      mockSendBeacon();
      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      Date.now.mockImplementation(() => 10500);

      await eventListeners.pagehide();

      const expectedBeacon = [
        expect.objectContaining({
          age: 500,
        }),
      ];

      const sentBeacon = navigator.sendBeacon.mock.calls[0][1];

      expect(JSON.parse(sentBeacon)).toEqual(expectedBeacon);
    });

    it('records the current URL of the page', async () => {
      mockSendBeacon();
      delete window.location;
      window.location = { href: 'https://www.example.com/foo/bar' };

      renderHook(() => useWebVitals({ enabled, reportingEndpoint }));

      await eventListeners.pagehide();

      const expectedBeacon = [
        expect.objectContaining({
          url: 'https://www.example.com/foo/bar',
        }),
      ];

      const sentBeacon = navigator.sendBeacon.mock.calls[0][1];

      expect(JSON.parse(sentBeacon)).toEqual(expectedBeacon);
    });

    it('calls the loggerCallback with an error if sendBeacon fails', async () => {
      mockSendBeacon();
      const error = new Error('Test error');
      navigator.sendBeacon.mockRejectedValue(error);

      const loggerCallback = jest.fn();

      renderHook(() => useWebVitals({ enabled, loggerCallback }));

      await eventListeners.pagehide();

      expect(loggerCallback).toHaveBeenCalledWith(error);
    });

    describe('when a sampleRate is provided', () => {
      it('should send web vitals data when the random number generated is equal to the provided rate', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.05);
        mockSendBeacon();

        renderHook(() =>
          useWebVitals({ enabled, reportingEndpoint, sampleRate: 5 }),
        );

        await eventListeners.pagehide();

        expect(navigator.sendBeacon).toHaveBeenCalled();
      });

      it('should send web vitals data when the random number generated is less than the provided rate', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.05);
        mockSendBeacon();

        renderHook(() =>
          useWebVitals({ enabled, reportingEndpoint, sampleRate: 15 }),
        );

        await eventListeners.pagehide();

        expect(navigator.sendBeacon).toHaveBeenCalled();
      });

      it('should not send web vitals data when the random number generated is more than the provided rate', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.35);
        mockSendBeacon();

        renderHook(() =>
          useWebVitals({ enabled, reportingEndpoint, sampleRate: 20 }),
        );

        await eventListeners.pagehide();

        expect(navigator.sendBeacon).not.toHaveBeenCalled();
      });
    });
  });
});
