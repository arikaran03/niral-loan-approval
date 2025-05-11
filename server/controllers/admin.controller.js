import Loan from '../database/models/LoanModel.js';
import LoanSubmission from '../database/models/LoanSubmissionModel.js';

export async function getDashboardStats(req, res) {
  try {
    const totalLoans = await Loan.countDocuments();
    const totalSubmissions = await LoanSubmission.countDocuments();

    // Submissions by stage
    const byStage = await LoanSubmission.aggregate([
      { $group: { _id: "$stage", count: { $sum: 1 } } }
    ]);

    // Submissions by loan scheme
    const submissionsByLoan = await LoanSubmission.aggregate([
      {
        $group: {
          _id: "$loan_id",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "loans", // The name of the Loan collection
          localField: "_id",
          foreignField: "_id",
          as: "loan",
        },
      },
      {
        $unwind: "$loan", // Deconstruct the loan array
      },
      {
        $project: {
          _id: 0,
          loanTitle: "$loan.title", // Get the loan title
          count: 1,
        },
      },
    ]);

    // Average amount requested
    const averageAmount = await LoanSubmission.aggregate([
      {
        $group: {
          _id: null,
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    // Loans by type (assuming you have a type field in your Loan model)
    const loansByType = await Loan.aggregate([
      {
        $group: {
          _id: "$type", // Group by the 'type' field in your Loan model
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          type: "$_id",
          count: 1
        }
      }
    ]);

    // Recent Submissions (last 5, for example)
    const recentSubmissions = await LoanSubmission.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate('user_id', 'name') // Populate user name
      .populate('loan_id', 'title')
      .select('loan_id user_id created_at stage amount');

    return res.json({
      totalLoans,
      totalSubmissions,
      submissionsByStage: byStage.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      submissionsByLoan,
      averageAmount: averageAmount.length > 0 ? averageAmount[0].avgAmount : 0,
      loansByType,
      recentSubmissions
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Failed to load dashboard stats" });
  }
}
