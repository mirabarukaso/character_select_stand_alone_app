let autoRetryState = {
    current_seconds: 0,
    current_count: 0,
    seconds: 20,
    count: 5,
    timer: null,
    retry: null,
    active: false,
    disabled: false
};

export function resetAutoRetry(seconds, counts) {
    const wasActive = autoRetryState.active;
    const retry = autoRetryState.retry;
    const currentCount = autoRetryState.current_count;

    stopAutoRetry();
    autoRetryState.seconds = seconds;
    autoRetryState.count = counts;
    autoRetryState.disabled = counts === 0;

    autoRetryState.current_seconds = seconds;
    autoRetryState.current_count = wasActive ? currentCount : 0;

    if (wasActive && !autoRetryState.disabled && autoRetryState.current_count < autoRetryState.count) {
        autoRetryState.retry = retry;
        autoRetryState.active = true;
        updateRetryInfo(getRetryMessage('busy_retry_countdown', autoRetryState.current_seconds, autoRetryState.current_count + 1, autoRetryState.count));
        startRetryTimer();
    } else if (wasActive) {
        updateRetryInfo('');
    }
};

function stopAutoRetry() {
    if (autoRetryState.timer !== null) {
        clearInterval(autoRetryState.timer);
        autoRetryState.timer = null;
    }
    autoRetryState.retry = null;
    autoRetryState.active = false;
}

export function cancelAutoRetry() {
    if(autoRetryState.active) {
        stopAutoRetry();
        updateRetryInfo('');
    }
}

function updateRetryInfo(message) {
    const retryInfo = document.querySelector('.queue-busy-retry');
    if (retryInfo) {
        retryInfo.textContent = message;
    }
}

function getRetryMessage(key, ...values) {
    const language = globalThis.cachedFiles.language[globalThis.globalSettings.language];
    let message = language[key];
    values.forEach((value, index) => {
        message = message.replace(`{${index}}`, value);
    });
    return message;
}

function isBusyResult(result) {
    const message = `${result?.retCopy ?? ''} ${result?.ret ?? ''}`;
    return message.includes('is busy, cannot run new generation, please try again later.');
}

async function retryQueue() {
    if (!autoRetryState.active || !autoRetryState.retry) {
        return;
    }

    updateRetryInfo(getRetryMessage('busy_retry_retrying', autoRetryState.current_count, autoRetryState.count));
    let result;
    try {
        result = await autoRetryState.retry();
    } catch (error) {
        if (!autoRetryState.active) {
            return;
        }
        stopAutoRetry();
        updateRetryInfo(getRetryMessage('busy_retry_failed'));
        console.error('Auto-retry failed:', error);
        return;
    }

    if (!autoRetryState.active) {
        return;
    }

    const busy = isBusyResult(result);
    const retryLimitReached = autoRetryState.current_count >= autoRetryState.count;
    if (!busy || retryLimitReached) {
        stopAutoRetry();
        if (busy) {
            updateRetryInfo(getRetryMessage('busy_retry_stopped', autoRetryState.count));
            globalThis.mainGallery.hideLoading(result.ret, result.retCopy);
            console.error('Auto-retry stopped: API is still busy.', result.retCopy);
        } else {
            updateRetryInfo('');
            document.getElementById('cg-error-overlay')?.remove();
        }
        return;
    }

    autoRetryState.current_seconds = autoRetryState.seconds;
    updateRetryInfo(getRetryMessage('busy_retry_countdown', autoRetryState.current_seconds, autoRetryState.current_count + 1, autoRetryState.count));
    startRetryTimer();
}

function startRetryTimer() {
    autoRetryState.timer = setInterval(() => {
        if (!autoRetryState.active) {
            clearInterval(autoRetryState.timer);
            autoRetryState.timer = null;
            return;
        }

        autoRetryState.current_seconds -= 1;
        if (autoRetryState.current_seconds > 0) {
            updateRetryInfo(getRetryMessage('busy_retry_countdown', autoRetryState.current_seconds, autoRetryState.current_count + 1, autoRetryState.count));
            return;
        }

        clearInterval(autoRetryState.timer);
        autoRetryState.timer = null;
        autoRetryState.current_count += 1;
        retryQueue();
    }, 1000);
}

export function isAutoRetryRunning() {
    return autoRetryState.active;
}

export function startAutoRetry(retry) {
    resetAutoRetry(globalThis.globalSettings.busy_retry_seconds, globalThis.globalSettings.busy_retry_counts);

    if (autoRetryState.disabled) {
        updateRetryInfo('');
        return;
    }

    autoRetryState.retry = retry;
    autoRetryState.active = true;

    if (autoRetryState.count === 0) {
        autoRetryState.active = false;
        return;
    }

    updateRetryInfo(getRetryMessage('busy_retry_countdown', autoRetryState.current_seconds, 1, autoRetryState.count));
    startRetryTimer();
}
