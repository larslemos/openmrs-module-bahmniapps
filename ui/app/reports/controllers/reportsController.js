'use strict';

angular.module('bahmni.reports')
    .controller('ReportsController', ['$scope', 'appService', 'reportService', 'FileUploader', 'messagingService', 'spinner', function ($scope, appService, reportService, FileUploader, messagingService, spinner) {
        $scope.uploader = new FileUploader({
            url: Bahmni.Common.Constants.uploadReportTemplateUrl,
            removeAfterUpload: true,
            autoUpload: true
        });

        $scope.uploader.onSuccessItem = function (fileItem, response) {
            fileItem.report.reportTemplateLocation = response;
        };

        $scope.default = {reportsRequiringDateRange: {}, reportsNotRequiringDateRange: {}};
        $scope.reportsDefined = true;

        $scope.setDefault = function (item, header) {
            var setToChange = header === 'reportsRequiringDateRange' ? $scope.reportsRequiringDateRange : $scope.reportsNotRequiringDateRange;
            setToChange.forEach(function (report) {
                report[item] = $scope.default[header][item];
            });
        };

        var isDateRangeRequiredFor = function (report) {
            return _.find($scope.reportsRequiringDateRange, {name: report.name});
        };

        var validateReport = function (report) {
            if(!report.responseType){
                messagingService.showMessage("error", "Select format for the report: " + report.name);
                return false;
            }
            if (report.responseType === 'application/vnd.ms-excel-custom' && !report.reportTemplateLocation) {
                if (!report.config.macroTemplatePath) {
                    messagingService.showMessage("error", "Workbook template should be selected for generating report: " + report.name);
                    return false;
                }
                report.reportTemplateLocation = report.config.macroTemplatePath;
            }
            report.startDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.startDate);
            report.stopDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.stopDate);
            if (isDateRangeRequiredFor(report) && (!report.startDate || !report.stopDate)) {
                var msg = [];
                if (!report.startDate) {
                    msg.push("start date");
                }
                if (!report.stopDate) {
                    msg.push("end date");
                }
                messagingService.showMessage("error", "Please select the " + msg.join(" and "));
                return false;
            }
            if(report.type == 'concatenated' && report.responseType == reportService.getMimeTypeForFormat('CSV')) {
                messagingService.showMessage('error', 'CSV format is not supported for concatenated reports');
                return false;
            }
            return true;
        };

        $scope.scheduleReport = function (report) {
            if (validateReport(report)) {
                spinner.forPromise(reportService.scheduleReport(report)).then(function(){
                    messagingService.showMessage("info", report.name + " added to My Reports");
                }, function() {
                    messagingService.showMessage("error", "Error in scheduling report");
                });
                if (report.responseType === 'application/vnd.ms-excel-custom') {
                    report.reportTemplateLocation = undefined;
                    report.responseType = _.values($scope.formats)[0];
                }
            }
        };

        var initializeFormats = function(){
            var supportedFormats = appService.getAppDescriptor().getConfigValue("supportedFormats") || _.keys(reportService.getAvailableFormats());
            supportedFormats = _.map(supportedFormats, function(format){
                return format.toUpperCase();
            });
            $scope.formats = _.pick(reportService.getAvailableFormats(), supportedFormats);
        };

        var initialization = function () {
            var reportList = appService.getAppDescriptor().getConfigForPage("reports");
            $scope.reportsRequiringDateRange = _.values(reportList).filter(function (report) {
                return !(report.config && report.config.dateRangeRequired === false);
            });
            $scope.reportsNotRequiringDateRange = _.values(reportList).filter(function (report) {
                return (report.config && report.config.dateRangeRequired === false);
            });
            $scope.reportsDefined = _.values(reportList).length > 0;

            initializeFormats();
        };

        initialization();
    }]);
