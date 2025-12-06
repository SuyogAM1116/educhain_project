package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	// "strconv" // No longer needed if grades are not calculated here initially

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EduChainContract implements the chaincode
type EduChainContract struct {
	contractapi.Contract
}

// ====================================================================================================
//                                           STRUCT DEFINITIONS
// ====================================================================================================

// CourseGrade represents the two phases and final grade for a specific course
type CourseGrade struct {
	Phase1 string `json:"phase1"`
	Phase2 string `json:"phase2"`
	Final  string `json:"final"` // Calculated average or final input
}

// Student represents the structure of a student
type Student struct {
	ID                string                 `json:"id"` // StudentID
	Name              string                 `json:"name"`
	Branch            string                 `json:"branch"`            // This will be 'department'
	Grades            map[string]CourseGrade `json:"grades"`            // Map course name to CourseGrade struct
	CourseAttendance  map[string]int         `json:"courseAttendance"`  // Map course name to total classes
	CoursePresentDays map[string]int         `json:"coursePresentDays"` // Map course name to present days
	Certificate       string                 `json:"certificate"`       // Generic certificate field
	CollegeID         string                 `json:"collegeID"`
	Email             string                 `json:"email"` // Provided by College Admin
	// AdmissionYear     string                 `json:"admissionYear"` // Removed as per new requirement
}

// Faculty represents the structure of a faculty
type Faculty struct {
	ID        string `json:"id"` // FacultyID
	Name      string `json:"name"`
	Dept      string `json:"dept"` // This will be 'department'
	CollegeID string `json:"collegeID"`
	Email     string `json:"email"` // Provided by College Admin
}

// College represents the structure of a college
type College struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Address             string `json:"address"`
	AccreditationStatus string `json:"accreditationStatus"`
	ContactEmail        string `json:"contactEmail"`
	ApplicationStatus   string `json:"applicationStatus"` // e.g., "Pending", "Approved", "Rejected"
}

// CollegeSummary represents a simplified view of a college for listing purposes
type CollegeSummary struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	ContactEmail        string `json:"contactEmail"`
	AccreditationStatus string `json:"accreditationStatus"`
	ApplicationStatus   string `json:"applicationStatus"`
}

// CollegeCertificate represents the certificate issued to an approved college
type CollegeCertificate struct {
	CertificateID string `json:"certificateID"`
	CollegeID     string `json:"collegeID"`
	CollegeName   string `json:"collegeName"`
	IssuedDate    string `json:"issuedDate"`
	Status        string `json:"status"`
	TransactionID string `json:"transactionID"`
}

// StudentCourseCertificate represents a certificate issued to a student for a specific course
type StudentCourseCertificate struct {
	CertificateID    string  `json:"certificateID"`
	StudentID        string  `json:"studentID"`
	StudentName      string  `json:"studentName"`
	CollegeID        string  `json:"collegeID"`
	CourseName       string  `json:"courseName"`
	FinalGrade       string  `json:"finalGrade"`
	FinalAttendance  float64 `json:"finalAttendance"` // Percentage
	IssuedDate       string  `json:"issuedDate"`
	TransactionID    string  `json:"transactionID"`
	OffChainDataHash string  `json:"offChainDataHash"`
}

// ====================================================================================================
//                                           COLLEGE FUNCTIONS
// ====================================================================================================

// RegisterCollege adds a new college application to the ledger
func (c *EduChainContract) RegisterCollege(ctx contractapi.TransactionContextInterface, id, name, address, accreditationStatus, contactEmail string) error {
	collegeJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("failed to read from ledger: %v", err)
	}
	if collegeJSON != nil {
		return fmt.Errorf("college with ID %s already exists", id)
	}

	college := College{
		ID:                  id,
		Name:                name,
		Address:             address,
		AccreditationStatus: accreditationStatus,
		ContactEmail:        contactEmail,
		ApplicationStatus:   "Pending",
	}
	collegeJSON, err = json.Marshal(college)
	if err != nil {
		return fmt.Errorf("failed to marshal college: %v", err)
	}
	return ctx.GetStub().PutState(id, collegeJSON)
}

// ApproveCollege updates the status of a college application to "Approved"
func (c *EduChainContract) ApproveCollege(ctx contractapi.TransactionContextInterface, collegeID string) error {
	collegeJSON, err := ctx.GetStub().GetState(collegeID)
	if err != nil {
		return fmt.Errorf("failed to read college: %v", err)
	}
	if collegeJSON == nil {
		return fmt.Errorf("college with ID %s not found", collegeID)
	}

	var college College
	err = json.Unmarshal(collegeJSON, &college)
	if err != nil {
		return fmt.Errorf("failed to unmarshal college: %v", err)
	}

	if college.ApplicationStatus == "Approved" {
		return fmt.Errorf("college %s is already approved", collegeID)
	}

	college.ApplicationStatus = "Approved"
	updatedCollegeJSON, err := json.Marshal(college)
	if err != nil {
		return fmt.Errorf("failed to marshal updated college: %v", err)
	}
	return ctx.GetStub().PutState(collegeID, updatedCollegeJSON)
}

// RejectCollege updates the status of a college application to "Rejected"
func (c *EduChainContract) RejectCollege(ctx contractapi.TransactionContextInterface, collegeID string) error {
	collegeJSON, err := ctx.GetStub().GetState(collegeID)
	if err != nil {
		return fmt.Errorf("failed to read college: %v", err)
	}
	if collegeJSON == nil {
		return fmt.Errorf("college with ID %s not found", collegeID)
	}

	var college College
	err = json.Unmarshal(collegeJSON, &college)
	if err != nil {
		return fmt.Errorf("failed to unmarshal college: %v", err)
	}

	if college.ApplicationStatus == "Rejected" {
		return fmt.Errorf("college %s is already rejected", collegeID)
	}

	college.ApplicationStatus = "Rejected"
	updatedCollegeJSON, err := json.Marshal(college)
	if err != nil {
		return fmt.Errorf("failed to marshal updated college: %v", err)
	}
	return ctx.GetStub().PutState(collegeID, updatedCollegeJSON)
}

// IssueCollegeCertificate issues a digital certificate for an approved college
func (c *EduChainContract) IssueCollegeCertificate(ctx contractapi.TransactionContextInterface, collegeID string, issuedDate string, transactionID string) error {
	collegeJSON, err := ctx.GetStub().GetState(collegeID)
	if err != nil {
		return fmt.Errorf("failed to read college: %v", err)
	}
	if collegeJSON == nil {
		return fmt.Errorf("college with ID %s not found", collegeID)
	}

	var college College
	err = json.Unmarshal(collegeJSON, &college)
	if err != nil {
		return fmt.Errorf("failed to unmarshal college: %v", err)
	}

	if college.ApplicationStatus != "Approved" {
		return fmt.Errorf("college %s is not approved, cannot issue certificate", collegeID)
	}

	certKey := fmt.Sprintf("COLLEGECERT_%s", collegeID)
	existingCertJSON, err := ctx.GetStub().GetState(certKey)
	if err != nil {
		return fmt.Errorf("failed to read existing certificate: %v", err)
	}
	if existingCertJSON != nil {
		return fmt.Errorf("certificate for college %s already exists", collegeID)
	}

	certificate := CollegeCertificate{
		CertificateID: certKey,
		CollegeID:     collegeID,
		CollegeName:   college.Name,
		IssuedDate:    issuedDate,
		Status:        "Approved by UGC & Active on Educhain",
		TransactionID: transactionID,
	}

	certificateJSON, err := json.Marshal(certificate)
	if err != nil {
		return fmt.Errorf("failed to marshal certificate: %v", err)
	}

	return ctx.GetStub().PutState(certKey, certificateJSON)
}

// QueryCollegeCertificate retrieves a digital certificate for a college
func (c *EduChainContract) QueryCollegeCertificate(ctx contractapi.TransactionContextInterface, collegeID string) (*CollegeCertificate, error) {
	certKey := fmt.Sprintf("COLLEGECERT_%s", collegeID)
	certificateJSON, err := ctx.GetStub().GetState(certKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate: %v", err)
	}
	if certificateJSON == nil {
		return nil, fmt.Errorf("certificate for college %s not found", collegeID)
	}

	var certificate CollegeCertificate
	err = json.Unmarshal(certificateJSON, &certificate)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal certificate: %v", err)
	}
	return &certificate, nil
}

// QueryCollege retrieves details of a college
func (c *EduChainContract) QueryCollege(ctx contractapi.TransactionContextInterface, id string) (*College, error) {
	collegeJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from ledger: %v", err)
	}
	if collegeJSON == nil {
		return nil, fmt.Errorf("college with ID %s not found", id)
	}

	var college College
	err = json.Unmarshal(collegeJSON, &college)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal college: %v", err)
	}
	return &college, nil
}

// GetDetailsOfColleges retrieves all colleges (including rejected) with full details
func (c *EduChainContract) GetDetailsOfColleges(ctx contractapi.TransactionContextInterface) ([]*College, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var colleges []*College
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var college CandidateCollege
		err = json.Unmarshal(queryResponse.Value, &college)
		if err == nil && college.ID != "" && college.Name != "" && college.Address != "" && college.ContactEmail != "" && college.ApplicationStatus != "" {
			var studentCheck Student
			var facultyCheck Faculty
			isStudent := json.Unmarshal(queryResponse.Value, &studentCheck) == nil && studentCheck.Branch != "" && studentCheck.CollegeID != ""
			isFaculty := json.Unmarshal(queryResponse.Value, &facultyCheck) == nil && facultyCheck.Dept != "" && facultyCheck.CollegeID != ""
			if !isStudent && !isFaculty {
				var actualCollege College
				json.Unmarshal(queryResponse.Value, &actualCollege)
				colleges = append(colleges, &actualCollege)
			}
		}
	}
	return colleges, nil
}

// GetAllColleges retrieves all approved and pending colleges with specific details (CollegeSummary)
func (c *EduChainContract) GetAllColleges(ctx contractapi.TransactionContextInterface) ([]*CollegeSummary, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var collegeSummaries []*CollegeSummary
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var college CandidateCollege
		err = json.Unmarshal(queryResponse.Value, &college)
		if err == nil && college.ID != "" && college.Name != "" && college.Address != "" && college.ContactEmail != "" && college.ApplicationStatus != "" {
			var studentCheck Student
			var facultyCheck Faculty
			isStudent := json.Unmarshal(queryResponse.Value, &studentCheck) == nil && studentCheck.Branch != "" && studentCheck.CollegeID != ""
			isFaculty := json.Unmarshal(queryResponse.Value, &facultyCheck) == nil && facultyCheck.Dept != "" && facultyCheck.CollegeID != ""
			if !isStudent && !isFaculty {
				if college.ApplicationStatus == "Approved" || college.ApplicationStatus == "Pending" {
					summary := CollegeSummary{
						ID:                  college.ID,
						Name:                college.Name,
						ContactEmail:        college.ContactEmail,
						AccreditationStatus: college.AccreditationStatus,
						ApplicationStatus:   college.ApplicationStatus,
					}
					collegeSummaries = append(collegeSummaries, &summary)
				}
			}
		}
	}
	return collegeSummaries, nil
}

// ====================================================================================================
//                                           STUDENT FUNCTIONS
// ====================================================================================================

// RegisterStudent adds a new student to the ledger
// Invoked by College Admin (collegeUser identity)
// New fields: studentID (id), name, email, department (branch), collegeID (implicit or passed)
func (c *EduChainContract) RegisterStudent(ctx contractapi.TransactionContextInterface, id, name, branch, collegeID, email string) error {
	studentJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("failed to read student: %v", err)
	}
	if studentJSON != nil {
		return fmt.Errorf("student with ID %s already exists", id)
	}

	// Verify if the collegeID exists and is approved
	collegeData, err := ctx.GetStub().GetState(collegeID)
	if err != nil || collegeData == nil {
		return fmt.Errorf("college with ID %s not found or cannot be accessed", collegeID)
	}
	var college College
	err = json.Unmarshal(collegeData, &college)
	if err != nil { // Check for unmarshal error
		return fmt.Errorf("failed to unmarshal college data for ID %s: %v", collegeID, err)
	}
	if college.ApplicationStatus != "Approved" { // Check status after successful unmarshal
		return fmt.Errorf("college with ID %s is not approved", collegeID)
	}

	// Removed authorization check for registeringFacultyID as College Admin is registering

	student := Student{
		ID:                id,     // StudentID from input
		Name:              name,   // Name from input
		Branch:            branch, // Department from input
		Grades:            make(map[string]CourseGrade),
		CourseAttendance:  make(map[string]int),
		CoursePresentDays: make(map[string]int),
		Certificate:       "",
		CollegeID:         collegeID, // CollegeID (must be passed by backend)
		Email:             email,     // Email from input
	}
	studentJSON, err = json.Marshal(student)
	if err != nil {
		return fmt.Errorf("failed to marshal student: %v", err)
	}
	return ctx.GetStub().PutState(id, studentJSON)
}

// RemoveStudent deletes a student from the ledger
func (c *EduChainContract) RemoveStudent(ctx contractapi.TransactionContextInterface, id string) error {
	studentJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("failed to read student: %v", err)
	}
	if studentJSON == nil {
		return fmt.Errorf("student not found")
	}
	var student Student
	err = json.Unmarshal(studentJSON, &student)
	if err != nil {
		return fmt.Errorf("failed to unmarshal student: %v", err)
	}
	if student.Branch == "" || student.CollegeID == "" {
		return fmt.Errorf("ID does not belong to a student or is malformed")
	}
	return ctx.GetStub().DelState(id)
}

// UpdateAttendance updates student attendance for a specific course
func (c *EduChainContract) UpdateAttendance(ctx contractapi.TransactionContextInterface, facultyID, studentID, courseName string, isPresent bool) error {
	studentJSON, err := ctx.GetStub().GetState(studentID)
	if err != nil {
		return fmt.Errorf("failed to read student: %v", err)
	}
	if studentJSON == nil {
		return fmt.Errorf("student not found")
	}
	var student Student
	err = json.Unmarshal(studentJSON, &student)
	if err != nil {
		return fmt.Errorf("failed to unmarshal student: %v", err)
	}

	facultyJSON, err := ctx.GetStub().GetState(facultyID)
	if err != nil {
		return fmt.Errorf("failed to read faculty: %v", err)
	}
	if facultyJSON == nil {
		return fmt.Errorf("faculty not found")
	}
	var faculty Faculty
	err = json.Unmarshal(facultyJSON, &faculty)
	if err != nil {
		return fmt.Errorf("failed to unmarshal faculty: %v", err)
	}

	if faculty.Dept != student.Branch {
		return fmt.Errorf("unauthorized: faculty from %s department cannot update attendance for %s branch", faculty.Dept, student.Branch)
	}
	if faculty.CollegeID != student.CollegeID {
		return fmt.Errorf("unauthorized: faculty from a different college cannot update this student's attendance")
	}

	if student.CourseAttendance == nil {
		student.CourseAttendance = make(map[string]int)
	}
	if student.CoursePresentDays == nil {
		student.CoursePresentDays = make(map[string]int)
	}

	student.CourseAttendance[courseName]++
	if isPresent {
		student.CoursePresentDays[courseName]++
	}

	updatedStudentJSON, err := json.Marshal(student)
	if err != nil {
		return fmt.Errorf("failed to marshal updated student: %v", err)
	}
	return ctx.GetStub().PutState(studentID, updatedStudentJSON)
}

// UpdateGrades updates the grades of a student for a specific course and phase
func (c *EduChainContract) UpdateGrades(ctx contractapi.TransactionContextInterface, facultyID, studentID, courseName, phase, grade string) error {
	studentJSON, err := ctx.GetStub().GetState(studentID)
	if err != nil {
		return fmt.Errorf("failed to read student data for ID %s: %v", studentID, err)
	}
	if studentJSON == nil {
		return fmt.Errorf("student with ID %s not found", studentID)
	}
	var student Student
	err = json.Unmarshal(studentJSON, &student)
	if err != nil {
		return fmt.Errorf("failed to unmarshal student data for ID %s: %v", studentID, err)
	}

	// Authorization: Verify faculty
	facultyJSON, err := ctx.GetStub().GetState(facultyID)
	if err != nil {
		return fmt.Errorf("failed to read faculty data for ID %s: %v", facultyID, err)
	}
	if facultyJSON == nil {
		return fmt.Errorf("faculty with ID %s not found", facultyID)
	}
	var faculty Faculty
	err = json.Unmarshal(facultyJSON, &faculty)
	if err != nil {
		return fmt.Errorf("failed to unmarshal faculty data for ID %s: %v", facultyID, err)
	}

	// Security Check: Ensure faculty and student are in the same college
	if faculty.CollegeID != student.CollegeID {
		return fmt.Errorf("authorization failed: faculty and student are not from the same college (%s vs %s)", faculty.CollegeID, student.CollegeID)
	}
	// Security Check: Ensure faculty's department matches student's branch (department)
	if faculty.Dept != student.Branch {
		return fmt.Errorf("authorization failed: faculty from department '%s' cannot update grades for student in department '%s'", faculty.Dept, student.Branch)
	}

	// Initialize grades map if nil
	if student.Grades == nil {
		student.Grades = make(map[string]CourseGrade)
	}

	courseGrades, ok := student.Grades[courseName]
	if !ok {
		courseGrades = CourseGrade{}
	}

	switch phase {
	case "Phase1":
		courseGrades.Phase1 = grade
	case "Phase2":
		courseGrades.Phase2 = grade
	case "Final":
		courseGrades.Final = grade // Directly set the final grade
	default:
		// The previous version of UpdateGrades here had an error message that only mentioned Phase1 or Phase2.
		// Correcting to include "Final" as a valid option, or adjusting if it's truly not intended to be set this way.
		// Given the case for "Final" above, we'll assume it's valid.
		// If you strictly want this function for Phase1/Phase2, the "Final" case should be removed.
		// For now, assuming "Final" is a valid phase to set directly.
		return fmt.Errorf("invalid grade phase '%s'. Must be 'Phase1', 'Phase2', or 'Final'", phase)
	}

	// Logic for automatic recalculation of Final grade if Phase1 and Phase2 are numeric
	// This part is from your latest main.go. It might overwrite a "Final" grade if Phase1/Phase2 are subsequently updated.
	if phase != "Final" && courseGrades.Phase1 != "" && courseGrades.Phase2 != "" { // Recalculate only if not explicitly setting Final
		p1, err1 := strconv.ParseFloat(courseGrades.Phase1, 64)
		p2, err2 := strconv.ParseFloat(courseGrades.Phase2, 64)
		if err1 == nil && err2 == nil {
			finalAvg := (p1 + p2) / 2.0
			courseGrades.Final = fmt.Sprintf("%.2f", finalAvg)
		} else {
			// If parsing fails (e.g., non-numeric grades like "A", "B"),
			// and a Final grade was not explicitly set, it might become "N/A".
			// If a Final grade was already explicitly set (e.g. "A+"), this "N/A" would overwrite it.
			// Consider if this automatic "N/A" overwrite is desired when phase grades are non-numeric.
			// For now, keeping your existing logic.
			if courseGrades.Final == "" { // Only set to N/A if Final isn't already set by some other means or explicitly
				courseGrades.Final = "N/A"
			}
		}
	}

	student.Grades[courseName] = courseGrades

	updatedStudentJSON, err := json.Marshal(student)
	if err != nil {
		return fmt.Errorf("failed to marshal updated student data for ID %s: %v", studentID, err)
	}
	return ctx.GetStub().PutState(studentID, updatedStudentJSON)
}

func (c *EduChainContract) IssueStudentCourseCertificate(ctx contractapi.TransactionContextInterface, issuerID string, studentID string, courseName string, issuedDate string, externalTransactionID string, offChainDataHash string) (*StudentCourseCertificate, error) {
	// 1. Authorize Issuer (e.g., faculty or college admin)
	// For now, we'll assume issuerID is a faculty. This logic might need to be more complex
	// if college admins can also issue.
	issuerJSON, err := ctx.GetStub().GetState(issuerID)
	if err != nil {
		return nil, fmt.Errorf("failed to read issuer data for ID %s: %v", issuerID, err)
	}
	if issuerJSON == nil {
		return nil, fmt.Errorf("issuer with ID %s not found", issuerID)
	}
	var issuer Faculty // Assuming faculty for now
	err = json.Unmarshal(issuerJSON, &issuer)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal issuer data for ID %s: %v", issuerID, err)
	}

	// 2. Retrieve Student Data
	studentJSON, err := ctx.GetStub().GetState(studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read student data for ID %s: %v", studentID, err)
	}
	if studentJSON == nil {
		return nil, fmt.Errorf("student with ID %s not found", studentID)
	}
	var student Student
	err = json.Unmarshal(studentJSON, &student)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal student data for ID %s: %v", studentID, err)
	}

	// Authorization Check: Issuer (faculty) and student must be from the same college.
	if issuer.CollegeID != student.CollegeID {
		return nil, fmt.Errorf("authorization failed: issuer and student are not from the same college (%s vs %s)", issuer.CollegeID, student.CollegeID)
	}
	// Authorization Check: Issuer (faculty) department must match student's branch for course-related actions.
	if issuer.Dept != student.Branch {
		return nil, fmt.Errorf("authorization failed: issuer from department '%s' cannot issue certificate for student in department '%s'", issuer.Dept, student.Branch)
	}

	// 3. Get Course-Specific Data from Student's Record
	courseGrades, gradesOk := student.Grades[courseName]
	if !gradesOk || courseGrades.Final == "" {
		return nil, fmt.Errorf("final grade for course '%s' not found or not set for student %s", courseName, studentID)
	}

	totalClasses, attendanceOk := student.CourseAttendance[courseName]
	presentDays, presentOk := student.CoursePresentDays[courseName]
	if !attendanceOk || !presentOk || totalClasses == 0 {
		// Allow issuing even with 0 attendance if that's a valid scenario, but finalAttendance will be 0.
		// If attendance is mandatory for a certificate, add a stricter check here.
		// For now, we'll proceed but finalAttendance calculation will handle totalClasses == 0.
		if totalClasses == 0 {
			// return nil, fmt.Errorf("attendance data for course '%s' incomplete or missing for student %s (total classes is 0)", courseName, studentID)
			log.Printf("Warning: Total classes for course '%s' is 0 for student %s. Final attendance will be 0%%.", courseName, studentID)
		}
	}

	var finalAttendancePercentage float64
	if totalClasses > 0 {
		finalAttendancePercentage = (float64(presentDays) / float64(totalClasses)) * 100
	} else {
		finalAttendancePercentage = 0 // Or handle as an error if 0 total classes is not permissible for cert
	}

	// 4. Create Certificate
	certificateID := fmt.Sprintf("STUDENTCERT_%s_%s", studentID, courseName) // Consistent Cert ID

	// Check if certificate already exists
	existingCertJSON, err := ctx.GetStub().GetState(certificateID)
	if err != nil {
		return nil, fmt.Errorf("failed to check for existing student course certificate: %v", err)
	}
	if existingCertJSON != nil {
		return nil, fmt.Errorf("student course certificate with ID %s already exists", certificateID)
	}

	certificate := StudentCourseCertificate{
		CertificateID:    certificateID,
		StudentID:        studentID,
		StudentName:      student.Name,
		CollegeID:        student.CollegeID,
		CourseName:       courseName,
		FinalGrade:       courseGrades.Final,
		FinalAttendance:  finalAttendancePercentage, // Calculated percentage
		IssuedDate:       issuedDate,
		TransactionID:    externalTransactionID, // Transaction ID from external system or backend
		OffChainDataHash: offChainDataHash,
	}

	certificateJSON, err := json.Marshal(certificate)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal student course certificate: %v", err)
	}

	err = ctx.GetStub().PutState(certificateID, certificateJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to put student course certificate on ledger: %v", err)
	}

	return &certificate, nil // Return the created certificate
}

// GetAllStudents retrieves all students from the ledger
func (s *EduChainContract) GetAllStudents(ctx contractapi.TransactionContextInterface) ([]*Student, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all students: %v", err)
	}
	defer iterator.Close()

	var students []*Student
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var student CandidateStudent
		err = json.Unmarshal(queryResponse.Value, &student)
		if err == nil && student.ID != "" && student.Name != "" && student.Branch != "" && student.CollegeID != "" {
			var facultyCheck Faculty
			var collegeCheck College
			isFaculty := json.Unmarshal(queryResponse.Value, &facultyCheck) == nil && facultyCheck.Dept != "" && facultyCheck.CollegeID != ""
			isCollege := json.Unmarshal(queryResponse.Value, &collegeCheck) == nil && collegeCheck.Address != "" && collegeCheck.ContactEmail != ""
			if !isFaculty && !isCollege {
				var actualStudent Student
				json.Unmarshal(queryResponse.Value, &actualStudent)
				if actualStudent.Grades == nil {
					actualStudent.Grades = make(map[string]CourseGrade)
				}
				if actualStudent.CourseAttendance == nil {
					actualStudent.CourseAttendance = make(map[string]int)
				}
				if actualStudent.CoursePresentDays == nil {
					actualStudent.CoursePresentDays = make(map[string]int)
				}
				students = append(students, &actualStudent)
			}
		}
	}
	return students, nil
}

// GetStudentsByDepartment retrieves students from a specific college and department
func (c *EduChainContract) GetStudentsByDepartment(ctx contractapi.TransactionContextInterface, collegeID, department string) ([]*Student, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get students by department: %v", err)
	}
	defer resultsIterator.Close()

	var students []*Student
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var student CandidateStudent
		err = json.Unmarshal(queryResponse.Value, &student)
		if err == nil && student.ID != "" && student.Name != "" && student.Branch != "" && student.CollegeID != "" {
			var facultyCheck Faculty
			var collegeCheck College
			isFaculty := json.Unmarshal(queryResponse.Value, &facultyCheck) == nil && facultyCheck.Dept != "" && facultyCheck.CollegeID != ""
			isCollege := json.Unmarshal(queryResponse.Value, &collegeCheck) == nil && collegeCheck.Address != "" && collegeCheck.ContactEmail != ""
			if !isFaculty && !isCollege {
				if student.CollegeID == collegeID && student.Branch == department {
					var actualStudent Student
					json.Unmarshal(queryResponse.Value, &actualStudent)
					if actualStudent.Grades == nil {
						actualStudent.Grades = make(map[string]CourseGrade)
					}
					if actualStudent.CourseAttendance == nil {
						actualStudent.CourseAttendance = make(map[string]int)
					}
					if actualStudent.CoursePresentDays == nil {
						actualStudent.CoursePresentDays = make(map[string]int)
					}
					students = append(students, &actualStudent)
				}
			}
		}
	}
	return students, nil
}

func (c *EduChainContract) QueryStudentCourseCertificate(ctx contractapi.TransactionContextInterface, studentID string, courseName string) (*StudentCourseCertificate, error) {
	// Construct the certificate ID based on the convention used in IssueStudentCourseCertificate
	certificateID := fmt.Sprintf("STUDENTCERT_%s_%s", studentID, courseName) // (derived from IssueStudentCourseCertificate logic)

	certificateJSON, err := ctx.GetStub().GetState(certificateID)
	if err != nil {
		return nil, fmt.Errorf("failed to read student course certificate from world state for ID %s: %v", certificateID, err)
	}
	if certificateJSON == nil {
		return nil, fmt.Errorf("student course certificate with ID %s does not exist", certificateID)
	}

	var certificate StudentCourseCertificate
	err = json.Unmarshal(certificateJSON, &certificate)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal student course certificate JSON for ID %s: %v", certificateID, err)
	}

	return &certificate, nil
}

// ====================================================================================================
//                                           FACULTY FUNCTIONS
// ====================================================================================================

// RegisterFaculty adds a new faculty to the ledger
// Invoked by College Admin (collegeUser identity)
// Fields: facultyID (id), name, email, department (dept), collegeID (implicit or passed)
func (c *EduChainContract) RegisterFaculty(ctx contractapi.TransactionContextInterface, id, name, dept, collegeID, email string) error {
	facultyJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("failed to read faculty: %v", err)
	}
	if facultyJSON != nil {
		return fmt.Errorf("faculty with ID %s already exists", id)
	}

	// Verify if the collegeID exists and is approved
	collegeData, err := ctx.GetStub().GetState(collegeID)
	if err != nil || collegeData == nil {
		return fmt.Errorf("college with ID %s not found or cannot be accessed", collegeID)
	}
	var college College
	err = json.Unmarshal(collegeData, &college)
	if err != nil { // Check for unmarshal error
		return fmt.Errorf("failed to unmarshal college data for ID %s: %v", collegeID, err)
	}
	if college.ApplicationStatus != "Approved" { // Check status after successful unmarshal
		return fmt.Errorf("college with ID %s is not approved", collegeID)
	}

	faculty := Faculty{
		ID:        id,        // FacultyID from input
		Name:      name,      // Name from input
		Dept:      dept,      // Department from input
		CollegeID: collegeID, // CollegeID (must be passed by backend)
		Email:     email,     // Email from input
	}
	facultyJSON, err = json.Marshal(faculty)
	if err != nil {
		return fmt.Errorf("failed to marshal faculty: %v", err)
	}
	return ctx.GetStub().PutState(id, facultyJSON)
}

// RemoveFaculty deletes a faculty member from the ledger
func (c *EduChainContract) RemoveFaculty(ctx contractapi.TransactionContextInterface, id string) error {
	facultyJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("failed to read faculty: %v", err)
	}
	if facultyJSON == nil {
		return fmt.Errorf("faculty not found")
	}
	var faculty Faculty
	err = json.Unmarshal(facultyJSON, &faculty)
	if err != nil {
		return fmt.Errorf("failed to unmarshal faculty: %v", err)
	}
	if faculty.Dept == "" || faculty.CollegeID == "" {
		return fmt.Errorf("ID does not belong to a faculty member or is malformed")
	}
	return ctx.GetStub().DelState(id)
}

// GetAllFaculty retrieves all faculty from the ledger
func (c *EduChainContract) GetAllFaculty(ctx contractapi.TransactionContextInterface) ([]*Faculty, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all faculty: %v", err)
	}
	defer iterator.Close()

	var faculties []*Faculty
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var faculty CandidateFaculty
		err = json.Unmarshal(queryResponse.Value, &faculty)
		if err == nil && faculty.ID != "" && faculty.Name != "" && faculty.Dept != "" && faculty.CollegeID != "" {
			var studentCheck Student
			var collegeCheck College
			isStudent := json.Unmarshal(queryResponse.Value, &studentCheck) == nil && studentCheck.Branch != "" && studentCheck.CollegeID != ""
			isCollege := json.Unmarshal(queryResponse.Value, &collegeCheck) == nil && collegeCheck.Address != "" && collegeCheck.ContactEmail != ""
			if !isStudent && !isCollege {
				var actualFaculty Faculty
				json.Unmarshal(queryResponse.Value, &actualFaculty)
				faculties = append(faculties, &actualFaculty)
			}
		}
	}
	return faculties, nil
}

// GetFacultyByDepartment retrieves faculty from a specific college and department
func (c *EduChainContract) GetFacultyByDepartment(ctx contractapi.TransactionContextInterface, collegeID, department string) ([]*Faculty, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get faculty by department: %v", err)
	}
	defer resultsIterator.Close()

	var faculties []*Faculty
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var faculty CandidateFaculty
		err = json.Unmarshal(queryResponse.Value, &faculty)
		if err == nil && faculty.ID != "" && faculty.Name != "" && faculty.Dept != "" && faculty.CollegeID != "" {
			var studentCheck Student
			var collegeCheck College
			isStudent := json.Unmarshal(queryResponse.Value, &studentCheck) == nil && studentCheck.Branch != "" && studentCheck.CollegeID != ""
			isCollege := json.Unmarshal(queryResponse.Value, &collegeCheck) == nil && collegeCheck.Address != "" && collegeCheck.ContactEmail != ""
			if !isStudent && !isCollege {
				if faculty.CollegeID == collegeID && faculty.Dept == department {
					var actualFaculty Faculty
					json.Unmarshal(queryResponse.Value, &actualFaculty)
					faculties = append(faculties, &actualFaculty)
				}
			}
		}
	}
	return faculties, nil
}

// ====================================================================================================
//                                           GENERIC FUNCTIONS
// ====================================================================================================

// QueryDetails retrieves details of a student, faculty, or college generically
func (c *EduChainContract) QueryDetails(ctx contractapi.TransactionContextInterface, id string) (string, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return "", fmt.Errorf("failed to read from ledger: %v", err)
	}
	if data == nil {
		return "", fmt.Errorf("ID not found")
	}
	return string(data), nil
}

// ====================================================================================================
//                                           MAIN FUNCTION
// ====================================================================================================

func main() {
	chaincode, err := contractapi.NewChaincode(new(EduChainContract))
	if err != nil {
		log.Panicf("Error creating chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting chaincode: %v", err)
	}
}

// ====================================================================================================
//
//	HELPER STRUCTS FOR UNMARSHALING
//
// ====================================================================================================
type CandidateCollege struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Address             string `json:"address"`
	AccreditationStatus string `json:"accreditationStatus"`
	ContactEmail        string `json:"contactEmail"`
	ApplicationStatus   string `json:"applicationStatus"`
	Branch              string `json:"branch"`
	Dept                string `json:"dept"`
}
type CandidateStudent struct {
	ID                string                 `json:"id"`
	Name              string                 `json:"name"`
	Branch            string                 `json:"branch"`
	Grades            map[string]interface{} `json:"grades"`
	CourseAttendance  map[string]int         `json:"courseAttendance"`
	CoursePresentDays map[string]int         `json:"coursePresentDays"`
	CollegeID         string                 `json:"collegeID"`
	Address           string                 `json:"address"`
	Dept              string                 `json:"dept"`
}
type CandidateFaculty struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Dept      string `json:"dept"`
	CollegeID string `json:"collegeID"`
	Branch    string `json:"branch"`
	Address   string `json:"address"`
}
