all: TimeSeries.mpk

TimeSeries.mpk:
	cd src && zip -r ../TimeSeries.mpk *

clean:
	rm -f TimeSeries.mpk
