import fetch from 'cross-fetch';
import { useEffect } from 'react';
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';
import {
  useNetworkStatus,
  useHardwareConcurrency,
  useMemoryStatus,
} from 'react-adaptive-hooks';
import useEvent from './use-event';

const noOp = () => {};

const webVitalsBase = {
  age: 0,
  type: 'web-vitals',
  url: 'current-page-url',
};

const vitals = { cls: null, fid: null, lcp: null, fcp: null, ttfb: null };
const deviceMetrics = {
  device_mem: null,
  device_cpu: null,
  device_effective_connection: null,
};

const updateWebVitals = ({ name, value }) => {
  const vitalName = name.toLowerCase();
  vitals[vitalName] = value;
};

const updateDeviceMetrics = ({
  deviceMemory,
  numberOfLogicalProcessors,
  effectiveConnectionType,
}) => {
  deviceMetrics.device_mem = deviceMemory;
  deviceMetrics.device_cpu = numberOfLogicalProcessors;
  deviceMetrics.device_effective_connection = effectiveConnectionType;
};

const setCurrentUrl = () => {
  webVitalsBase.url = window.location.href;
};

const appendReportParams = (reportingEndpoint, reportParams) => {
  const url = new URL(reportingEndpoint);
  const reportParamKeys = Object.keys(reportParams);
  const paramsString = reportParamKeys
    .map(param => `${param}=${reportParams[param]}`)
    .join('&');

  return url.search
    ? `${reportingEndpoint}&${paramsString}`
    : `${reportingEndpoint}?${paramsString}`;
};

const sendBeacon = (rawBeacon, reportingEndpoint, reportParams) => {
  const beacon = JSON.stringify(rawBeacon);
  const beaconTarget = reportParams
    ? appendReportParams(reportingEndpoint, reportParams)
    : reportingEndpoint;

  if (navigator.sendBeacon) {
    const headers = { type: 'application/reports+json' };
    const blob = new Blob([beacon], headers);
    return navigator.sendBeacon(beaconTarget, blob);
  }
  return fetch(beaconTarget, {
    method: 'POST',
    headers: { 'Content-Type': 'application/reports+json' },
    body: beacon,
    mode: 'no-cors',
  });
};

const shouldSample = sampleRate => {
  const randomNumber = Math.floor(Math.random() * 100);
  return randomNumber <= sampleRate;
};

const useWebVitals = ({
  enabled,
  reportingEndpoint,
  loggerCallback = noOp,
  sampleRate = 100,
  reportParams,
}) => {
  let pageLoadTime;
  const shouldSendVitals = enabled && shouldSample(sampleRate);

  const { effectiveConnectionType } = useNetworkStatus();
  const { numberOfLogicalProcessors } = useHardwareConcurrency();
  const { deviceMemory } = useMemoryStatus();

  const sendVitals = async () => {
    const pageExitTime = Date.now();
    const pageAge = pageExitTime - pageLoadTime;

    const beacon = [
      { ...webVitalsBase, age: pageAge, body: { ...vitals, ...deviceMetrics } },
    ];

    try {
      await sendBeacon(beacon, reportingEndpoint, reportParams);
    } catch (error) {
      loggerCallback(error);
    }
  };

  useEvent('pagehide', shouldSendVitals ? sendVitals : noOp);

  useEffect(() => {
    pageLoadTime = Date.now();
    setCurrentUrl();
    updateDeviceMetrics({
      effectiveConnectionType,
      numberOfLogicalProcessors,
      deviceMemory,
    });
    getCLS(updateWebVitals);
    getFID(updateWebVitals);
    getLCP(updateWebVitals);
    getFCP(updateWebVitals);
    getTTFB(updateWebVitals);
  }, []);

  return null;
};

export default useWebVitals;
