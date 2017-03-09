all: TimeSeriesWidget.mpk

TimeSeriesWidget.mpk:
	cd src && zip -r ../TimeSeriesWidget.mpk *

clean:
	rm -f TimeSeriesWidget.mpk
